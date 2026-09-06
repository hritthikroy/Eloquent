package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleHilaNinaPromo_Success(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/promo/hila-nina", nil)
	w := httptest.NewRecorder()

	HandleHilaNinaPromo(w, req)

	res := w.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}

	contentType := res.Header.Get("Content-Type")
	if contentType != "application/json; charset=utf-8" {
		t.Errorf("expected Content-Type application/json; charset=utf-8, got %s", contentType)
	}

	var payload PromoPayload
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if payload.Title != "Hila Nina" {
		t.Errorf("expected title 'Hila Nina', got %s", payload.Title)
	}
	if payload.Description.EN == "" || payload.Description.BN == "" {
		t.Errorf("expected bilingual description, got en: %q, bn: %q", payload.Description.EN, payload.Description.BN)
	}
	if payload.ImageURL == "" {
		t.Errorf("expected artwork URL, got empty string")
	}
	if payload.StreamURL == "" {
		t.Errorf("expected streaming URL, got empty string")
	}
	if payload.CTAText.EN != "Listen together" {
		t.Errorf("expected CTA EN 'Listen together', got %s", payload.CTAText.EN)
	}
}

func TestHandleHilaNinaPromo_MethodNotAllowed(t *testing.T) {
	methods := []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch}
	for _, m := range methods {
		req := httptest.NewRequest(m, "/api/promo/hila-nina", nil)
		w := httptest.NewRecorder()

		HandleHilaNinaPromo(w, req)

		res := w.Result()
		res.Body.Close()

		if res.StatusCode != http.StatusMethodNotAllowed {
			t.Errorf("method %s: expected status 405, got %d", m, res.StatusCode)
		}
	}
}

func TestHandleHilaNinaPromo_EdgeCases(t *testing.T) {
	// Test missing Bengali override
	req := httptest.NewRequest(http.MethodGet, "/api/promo/hila-nina?missing_bn=true", nil)
	w := httptest.NewRecorder()
	HandleHilaNinaPromo(w, req)
	var p1 PromoPayload
	_ = json.NewDecoder(w.Result().Body).Decode(&p1)
	if p1.Description.BN != "" {
		t.Errorf("expected empty BN description with missing_bn=true, got %q", p1.Description.BN)
	}

	// Test missing artwork override
	req2 := httptest.NewRequest(http.MethodGet, "/api/promo/hila-nina?missing_artwork=true", nil)
	w2 := httptest.NewRecorder()
	HandleHilaNinaPromo(w2, req2)
	var p2 PromoPayload
	_ = json.NewDecoder(w2.Result().Body).Decode(&p2)
	if p2.ImageURL != "" {
		t.Errorf("expected empty ImageURL with missing_artwork=true, got %q", p2.ImageURL)
	}

	// Test bad stream override
	req3 := httptest.NewRequest(http.MethodGet, "/api/promo/hila-nina?bad_stream=true", nil)
	w3 := httptest.NewRecorder()
	HandleHilaNinaPromo(w3, req3)
	var p3 PromoPayload
	_ = json.NewDecoder(w3.Result().Body).Decode(&p3)
	if p3.StreamURL != "" {
		t.Errorf("expected empty StreamURL with bad_stream=true, got %q", p3.StreamURL)
	}
}
