package main

import (
	"net/http"

	"eloquent/src/go/api"
)

// CORSMiddleware wraps an http.Handler with standard CORS headers tailored for Electron renderers.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// NewRouter constructs the HTTP servemux with all application routes and CORS middleware.
func NewRouter() http.Handler {
	mux := http.NewServeMux()

	// Promo API Route
	mux.HandleFunc("/api/promo/hila-nina", api.HandleHilaNinaPromo)

	// System Health Check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"eloquent-backend"}`))
	})

	return CORSMiddleware(mux)
}

func main() {
	router := NewRouter()
	_ = http.ListenAndServe(":8080", router)
}
