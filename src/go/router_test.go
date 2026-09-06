package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRouter_CORSPreflight(t *testing.T) {
	router := NewRouter()

	req := httptest.NewRequest(http.MethodOptions, "/api/promo/hila-nina", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	res := w.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNoContent {
		t.Errorf("expected status 204 No Content for OPTIONS, got %d", res.StatusCode)
	}

	allowOrigin := res.Header.Get("Access-Control-Allow-Origin")
	if allowOrigin != "http://localhost:3000" {
		t.Errorf("expected Access-Control-Allow-Origin http://localhost:3000, got %s", allowOrigin)
	}

	allowMethods := res.Header.Get("Access-Control-Allow-Methods")
	if allowMethods == "" {
		t.Errorf("expected Access-Control-Allow-Methods header to be set")
	}
}

func TestRouter_PromoRoute(t *testing.T) {
	router := NewRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/promo/hila-nina", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	res := w.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for promo route, got %d", res.StatusCode)
	}

	if res.Header.Get("Access-Control-Allow-Origin") == "" {
		t.Errorf("expected CORS header on promo route response")
	}
}

func TestRouter_HealthCheck(t *testing.T) {
	router := NewRouter()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	res := w.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 for health route, got %d", res.StatusCode)
	}
}
