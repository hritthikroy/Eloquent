// Package audio provides real-time audio pipeline concurrency, zero-copy buffer
// management, and synchronization protocols between Go and Node.js/Electron.
package audio

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"unsafe"
)

var (
	// ErrAlignmentViolation indicates a pointer was not aligned to an 8-byte boundary.
	ErrAlignmentViolation = errors.New("buffer pointer violates required 8-byte alignment")
	// ErrTransferAborted indicates that memory flag contention aborted a zero-copy handoff.
	ErrTransferAborted = errors.New("zero-copy transfer aborted: memory flag contention detected")
	// ErrBridgeClosed indicates the IPC bridge has been shut down.
	ErrBridgeClosed = errors.New("IPC bridge is closed")
)

// TransferDirection specifies the flow direction of audio data across runtimes.
type TransferDirection uint8

const (
	// DirectionInbound indicates data flowing into Go from Electron/Node.js.
	DirectionInbound TransferDirection = iota
	// DirectionOutbound indicates data flowing out of Go towards Electron/Node.js.
	DirectionOutbound
)

// MemoryFlag bitmask constants representing lock-free cross-runtime ownership states.
const (
	FlagFree       uint32 = 0x00
	FlagWriting    uint32 = 0x01
	FlagReading    uint32 = 0x02
	FlagDirty      uint32 = 0x04
	FlagContention uint32 = 0x08
)

// BridgeFrame encapsulates a zero-copy audio chunk with pointer validation metadata.
type BridgeFrame struct {
	ID          uint64            `json:"id"`
	Ptr         uintptr           `json:"ptr"` // Starting memory address of Data
	Data        []byte            `json:"data"`
	Size        int               `json:"size"`
	Direction   TransferDirection `json:"direction"`
	TimestampNs int64             `json:"timestampNs"`
	Flags       uint32            `json:"flags"`
	RMS         float64           `json:"rms"`
	Peak        int16             `json:"peak"`
}

// BridgeMetrics provides lock-free operational statistics on IPC bridge activity.
type BridgeMetrics struct {
	ContentionCount  uint64 `json:"contentionCount"`
	TransferredCount uint64 `json:"transferredCount"`
	BytesTransferred uint64 `json:"bytesTransferred"`
	AlignmentFails   uint64 `json:"alignmentFails"`
	FlagWord         uint32 `json:"flagWord"`
	IsClosed         bool   `json:"isClosed"`
}

// ZeroCopyBridge mediates cross-runtime audio streaming while ensuring pointer alignment
// and resolving memory flag contention without deadlocks.
type ZeroCopyBridge struct {
	pool             sync.Pool
	flagWord         uint32 // Atomic bitmask for memory flags
	inChan           chan *BridgeFrame
	outChan          chan *BridgeFrame
	isClosed         atomic.Bool
	contention       atomic.Uint64
	transferred      atomic.Uint64
	bytesTransferred atomic.Uint64
	frameIDCounter   atomic.Uint64
	alignFails       atomic.Uint64
}

// NewZeroCopyBridge initializes a zero-copy memory bridge with buffered channels.
func NewZeroCopyBridge() *ZeroCopyBridge {
	b := &ZeroCopyBridge{
		inChan:  make(chan *BridgeFrame, 256),
		outChan: make(chan *BridgeFrame, 256),
	}

	b.pool.New = func() interface{} {
		return &BridgeFrame{}
	}

	return b
}

// verifyAlignment asserts that the underlying array pointer is 8-byte aligned.
func (zc *ZeroCopyBridge) verifyAlignment(b []byte) error {
	if len(b) == 0 {
		return nil
	}
	ptr := uintptr(unsafe.Pointer(&b[0]))
	if ptr&0x07 != 0 {
		zc.alignFails.Add(1)
		return fmt.Errorf("%w: ptr 0x%x is not 8-byte aligned", ErrAlignmentViolation, ptr)
	}
	return nil
}

// acquireFlag performs a compare-and-swap on the shared flag word.
func (zc *ZeroCopyBridge) acquireFlag(flag uint32) bool {
	if atomic.CompareAndSwapUint32(&zc.flagWord, FlagFree, flag) {
		return true
	}
	// Contention encountered: mark contention flag and record metric
	atomic.OrUint32(&zc.flagWord, FlagContention)
	zc.contention.Add(1)
	return false
}

// releaseFlag clears the specified flag bit and contention flag if idle.
func (zc *ZeroCopyBridge) releaseFlag(flag uint32) {
	atomic.AndUint32(&zc.flagWord, ^flag)
	if atomic.LoadUint32(&zc.flagWord)&(FlagWriting|FlagReading) == 0 {
		atomic.AndUint32(&zc.flagWord, ^FlagContention)
	}
}

// Transfer processes an incoming or outgoing audio byte slice using zero-copy semantics.
func (zc *ZeroCopyBridge) Transfer(data []byte, dir TransferDirection) (*BridgeFrame, error) {
	if zc.isClosed.Load() {
		return nil, ErrBridgeClosed
	}
	if len(data) == 0 {
		return nil, errors.New("cannot transfer empty data slice")
	}

	if err := zc.verifyAlignment(data); err != nil {
		return nil, err
	}

	targetFlag := FlagWriting
	targetChan := zc.inChan
	if dir == DirectionOutbound {
		targetFlag = FlagReading
		targetChan = zc.outChan
	}

	if !zc.acquireFlag(targetFlag) {
		return nil, ErrTransferAborted
	}
	defer zc.releaseFlag(targetFlag)

	obj := zc.pool.Get()
	frame, ok := obj.(*BridgeFrame)
	if !ok || frame == nil {
		frame = &BridgeFrame{}
	}

	frame.ID = zc.frameIDCounter.Add(1)
	frame.Ptr = uintptr(unsafe.Pointer(&data[0]))
	frame.Data = data
	frame.Size = len(data)
	frame.Direction = dir
	frame.Flags = targetFlag
	frame.RMS = 0
	frame.Peak = 0

	select {
	case targetChan <- frame:
		zc.transferred.Add(1)
		zc.bytesTransferred.Add(uint64(len(data)))
		return frame, nil
	default:
		// Channel saturated: avoid blocking the audio pipeline
		zc.ReleaseFrame(frame)
		return nil, errors.New("zero-copy bridge channel queue saturated")
	}
}

// InboundFrames provides read-only access to inbound bridge frames.
func (zc *ZeroCopyBridge) InboundFrames() <-chan *BridgeFrame {
	return zc.inChan
}

// OutboundFrames provides read-only access to outbound bridge frames.
func (zc *ZeroCopyBridge) OutboundFrames() <-chan *BridgeFrame {
	return zc.outChan
}

// ReleaseFrame clears references and returns the BridgeFrame to the pool.
func (zc *ZeroCopyBridge) ReleaseFrame(f *BridgeFrame) {
	if f == nil {
		return
	}
	f.Data = nil
	f.Ptr = 0
	f.Size = 0
	f.Flags = FlagFree
	zc.pool.Put(f)
}

// GetMetrics returns a point-in-time snapshot of bridge metrics.
func (zc *ZeroCopyBridge) GetMetrics() BridgeMetrics {
	return BridgeMetrics{
		ContentionCount:  zc.contention.Load(),
		TransferredCount: zc.transferred.Load(),
		BytesTransferred: zc.bytesTransferred.Load(),
		AlignmentFails:   zc.alignFails.Load(),
		FlagWord:         atomic.LoadUint32(&zc.flagWord),
		IsClosed:         zc.isClosed.Load(),
	}
}

// Close gracefully terminates the zero-copy bridge and marks channels closed.
func (zc *ZeroCopyBridge) Close() error {
	if zc.isClosed.Swap(true) {
		return nil
	}
	close(zc.inChan)
	close(zc.outChan)
	return nil
}
