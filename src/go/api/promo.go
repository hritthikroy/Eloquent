package api

import (
	"encoding/json"
	"net/http"
)

// BilingualText represents localized strings in English and Bengali.
type BilingualText struct {
	EN string `json:"en"`
	BN string `json:"bn"`
}

// PromoPayload defines the response schema for the promotional modal.
type PromoPayload struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Artist      string        `json:"artist"`
	Description BilingualText `json:"description"`
	ImageURL    string        `json:"imageUrl"`
	StreamURL   string        `json:"streamUrl"`
	CTAText     BilingualText `json:"ctaText"`
	Duration    string        `json:"duration"`
}

// DefaultHilaNinaPromo returns the production metadata for Hila Nina.
func DefaultHilaNinaPromo() PromoPayload {
	return PromoPayload{
		ID:     "hila-nina-promo",
		Title:  "Hila Nina",
		Artist: "Hila Nina & The Ambient Collective",
		Description: BilingualText{
			EN: "Experience the soulful harmonies of Hila Nina, blending classical acoustics with contemporary ambient rhythm.",
			BN: "হিলা নিনার হৃদয়স্পর্শী সুর উপভোগ করুন, যেখানে শাস্ত্রীয় রাগ ও আধুনিক অ্যাম্বিয়েন্ট সঙ্গীতের মেলবন্ধন ঘটেছে।",
		},
		ImageURL:  "https://assets.eloquent.internal/art/hila-nina.jpg",
		StreamURL: "https://stream.eloquent.internal/audio/hila-nina-master.mp3",
		CTAText: BilingualText{
			EN: "Listen together",
			BN: "একসাথে শুনুন",
		},
		Duration: "3:45",
	}
}

// HandleHilaNinaPromo serves the Hila Nina promotional payload.
func HandleHilaNinaPromo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	payload := DefaultHilaNinaPromo()

	// Allow query param override for testing edge cases
	if r.URL.Query().Get("missing_bn") == "true" {
		payload.Description.BN = ""
		payload.CTAText.BN = ""
	}
	if r.URL.Query().Get("missing_artwork") == "true" {
		payload.ImageURL = ""
	}
	if r.URL.Query().Get("bad_stream") == "true" {
		payload.StreamURL = ""
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}
