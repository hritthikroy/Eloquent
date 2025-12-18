package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"

	"golang.org/x/crypto/scrypt"
)

type SessionService struct {
	deviceID string
}

type SessionData struct {
	SupabaseSession map[string]interface{} `json:"supabaseSession"`
	User            map[string]interface{} `json:"user"`
	Subscription    map[string]interface{} `json:"subscription"`
	Usage           map[string]interface{} `json:"usage"`
}

func NewSessionService(deviceID string) *SessionService {
	return &SessionService{
		deviceID: deviceID,
	}
}

func (s *SessionService) StoreSession(data *SessionData, userDataPath string) error {
	sessionFile := filepath.Join(userDataPath, "session.enc")
	
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}

	encrypted, err := s.encrypt(string(jsonData))
	if err != nil {
		return fmt.Errorf("failed to encrypt session: %w", err)
	}

	return os.WriteFile(sessionFile, []byte(encrypted), 0600)
}

func (s *SessionService) LoadSession(userDataPath string) (*SessionData, error) {
	sessionFile := filepath.Join(userDataPath, "session.enc")
	
	if _, err := os.Stat(sessionFile); os.IsNotExist(err) {
		return nil, nil // No session file exists
	}

	encrypted, err := os.ReadFile(sessionFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read session file: %w", err)
	}

	decrypted, err := s.decrypt(string(encrypted))
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt session: %w", err)
	}

	var data SessionData
	if err := json.Unmarshal([]byte(decrypted), &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session data: %w", err)
	}

	return &data, nil
}

func (s *SessionService) ClearSession(userDataPath string) error {
	sessionFile := filepath.Join(userDataPath, "session.enc")
	if _, err := os.Stat(sessionFile); os.IsNotExist(err) {
		return nil // File doesn't exist, nothing to clear
	}
	return os.Remove(sessionFile)
}

func (s *SessionService) encrypt(text string) (string, error) {
	// Derive key from device ID using scrypt (same as Node.js version)
	key, err := scrypt.Key([]byte(s.deviceID), []byte("eloquent-salt-v2"), 32768, 8, 1, 32)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Generate random IV
	iv := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// Use GCM mode for authenticated encryption
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, iv, []byte(text), nil)
	
	// Format: iv:ciphertext (hex encoded)
	return hex.EncodeToString(iv) + ":" + hex.EncodeToString(ciphertext), nil
}

func (s *SessionService) decrypt(encryptedData string) (string, error) {
	// Parse IV and ciphertext
	parts := []string{}
	colonIndex := -1
	for i, char := range encryptedData {
		if char == ':' {
			colonIndex = i
			break
		}
	}
	
	if colonIndex == -1 {
		return "", fmt.Errorf("invalid encrypted data format")
	}
	
	parts = append(parts, encryptedData[:colonIndex])
	parts = append(parts, encryptedData[colonIndex+1:])

	if len(parts) != 2 {
		return "", fmt.Errorf("invalid encrypted data format")
	}

	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return "", err
	}

	ciphertext, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", err
	}

	// Derive key (same as encrypt)
	key, err := scrypt.Key([]byte(s.deviceID), []byte("eloquent-salt-v2"), 32768, 8, 1, 32)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (s *SessionService) GetDeviceID() string {
	if s.deviceID != "" {
		return s.deviceID
	}

	// Generate device ID based on system info (similar to Node.js version)
	hostname, _ := os.Hostname()
	machineInfo := fmt.Sprintf("%s-%s-%s", hostname, runtime.GOOS, runtime.GOARCH)
	
	hash := sha256.Sum256([]byte(machineInfo))
	return hex.EncodeToString(hash[:])[:32]
}