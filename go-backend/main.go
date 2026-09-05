package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	port := flag.Int("port", 9090, "HTTP server port")
	pipeMode := flag.Bool("pipe", false, "Run in stdin/stdout pipe mode")
	flag.Parse()

	// Check environment variable override for PORT
	if envPort := os.Getenv("PORT"); envPort != "" && *port == 9090 {
		var p int
		if _, err := fmt.Sscanf(envPort, "%d", &p); err == nil && p > 0 {
			*port = p
		}
	}

	if *pipeMode || (len(flag.Args()) > 0 && flag.Args()[0] == "pipe") {
		// Read input from stdin
		inputBytes, err := io.ReadAll(os.Stdin)
		if err != nil {
			log.Fatalf("Error reading from stdin: %v", err)
		}
		text := string(inputBytes)
		if text == "" && len(flag.Args()) > 1 {
			text = flag.Args()[1]
		}
		audio, err := GenerateBengaliAudio(text)
		if err != nil {
			log.Fatalf("Synthesis error: %v", err)
		}
		os.Stdout.Write(audio)
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/tts/bangla", TTSHandler)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"eloquent-audio-bengali-tts","sampleRate":24000}`))
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("🎙️ Eloquent Bengali Audio Service listening on port %d...", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	}()

	<-stopChan
	log.Println("🛑 Shutting down Bengali Audio Service...")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Graceful shutdown error: %v", err)
	}
	log.Println("✅ Bengali Audio Service stopped cleanly.")
}
