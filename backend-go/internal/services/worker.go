package services

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"
)

// PERFORMANCE BOOST: Worker pool for handling concurrent transcription requests
type WorkerPool struct {
	workers    int
	jobQueue   chan Job
	workerPool chan chan Job
	quit       chan bool
	wg         sync.WaitGroup
}

type Job struct {
	ID       string
	Function func() error
	Result   chan error
	Context  context.Context
}

type Worker struct {
	ID         int
	JobChannel chan Job
	WorkerPool chan chan Job
	Quit       chan bool
}

var (
	transcriptionPool *WorkerPool
	poolOnce          sync.Once
)

// PERFORMANCE BOOST: Get singleton worker pool
func GetTranscriptionPool() *WorkerPool {
	poolOnce.Do(func() {
		// Use number of CPU cores for optimal performance
		workers := runtime.NumCPU()
		if workers < 2 {
			workers = 2
		}
		if workers > 8 {
			workers = 8 // Cap at 8 for transcription workload
		}
		
		transcriptionPool = NewWorkerPool(workers, 100) // 100 job queue size
		transcriptionPool.Start()
		
		log.Printf("🚀 Started transcription worker pool with %d workers", workers)
	})
	return transcriptionPool
}

// PERFORMANCE BOOST: Create new worker pool
func NewWorkerPool(workers, queueSize int) *WorkerPool {
	return &WorkerPool{
		workers:    workers,
		jobQueue:   make(chan Job, queueSize),
		workerPool: make(chan chan Job, workers),
		quit:       make(chan bool),
	}
}

// PERFORMANCE BOOST: Start worker pool
func (p *WorkerPool) Start() {
	for i := 0; i < p.workers; i++ {
		worker := &Worker{
			ID:         i + 1,
			JobChannel: make(chan Job),
			WorkerPool: p.workerPool,
			Quit:       make(chan bool),
		}
		
		p.wg.Add(1)
		go worker.Start(&p.wg)
	}
	
	// Start dispatcher
	go p.dispatch()
}

// PERFORMANCE BOOST: Stop worker pool gracefully
func (p *WorkerPool) Stop() {
	close(p.quit)
	p.wg.Wait()
}

// PERFORMANCE BOOST: Submit job to worker pool
func (p *WorkerPool) Submit(job Job) error {
	select {
	case p.jobQueue <- job:
		return nil
	case <-time.After(5 * time.Second):
		return fmt.Errorf("job queue full, request timeout")
	}
}

// PERFORMANCE BOOST: Dispatch jobs to available workers
func (p *WorkerPool) dispatch() {
	for {
		select {
		case job := <-p.jobQueue:
			// Get available worker
			select {
			case jobChannel := <-p.workerPool:
				// Dispatch job to worker
				select {
				case jobChannel <- job:
				case <-time.After(1 * time.Second):
					// Worker timeout, put job back in queue
					select {
					case p.jobQueue <- job:
					default:
						// Queue full, send error
						job.Result <- fmt.Errorf("worker timeout and queue full")
					}
				}
			case <-time.After(5 * time.Second):
				// No workers available, send error
				job.Result <- fmt.Errorf("no workers available")
			}
		case <-p.quit:
			return
		}
	}
}

// PERFORMANCE BOOST: Worker implementation
func (w *Worker) Start(wg *sync.WaitGroup) {
	defer wg.Done()
	
	for {
		// Add worker to pool
		w.WorkerPool <- w.JobChannel
		
		select {
		case job := <-w.JobChannel:
			// Execute job with timeout
			done := make(chan error, 1)
			
			go func() {
				defer func() {
					if r := recover(); r != nil {
						done <- fmt.Errorf("worker panic: %v", r)
					}
				}()
				done <- job.Function()
			}()
			
			select {
			case err := <-done:
				job.Result <- err
			case <-job.Context.Done():
				job.Result <- job.Context.Err()
			case <-time.After(60 * time.Second): // Job timeout
				job.Result <- fmt.Errorf("job execution timeout")
			}
			
		case <-w.Quit:
			return
		}
	}
}

// PERFORMANCE BOOST: Helper function to submit transcription job
func SubmitTranscriptionJob(ctx context.Context, fn func() error) error {
	job := Job{
		ID:       fmt.Sprintf("transcription-%d", time.Now().UnixNano()),
		Function: fn,
		Result:   make(chan error, 1),
		Context:  ctx,
	}
	
	pool := GetTranscriptionPool()
	if err := pool.Submit(job); err != nil {
		return err
	}
	
	return <-job.Result
}