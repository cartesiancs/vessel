package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
)

type RegisterRequest struct {
	Topic string `json:"topic"`
	MediaType string `json:"media_type"`
}

type RegisterResponse struct {
	Ssrc    uint32 `json:"ssrc"`
	RtpPort uint16 `json:"rtp_port"`
}

func main() {
	deviceId := "audio"
	deviceToken := "FnhXd7dNy8iCPbu5N5jS2v_NaOYCiI9AqPO4FQQed7E"

	serverURL := "http://127.0.0.1:8080/api/streams/register"
	topic := "go_video_stream_1"
	mediaType := "video"

	if deviceId == "" || deviceToken == "" {
		fmt.Println("Error: Please set the deviceId and deviceToken variables.")
		return
	}

	reqBody := RegisterRequest{Topic: topic, MediaType: mediaType}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		fmt.Printf("Error marshalling request body: %v\n", err)
		return
	}

	req, err := http.NewRequest("POST", serverURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Device-Id", deviceId)
	req.Header.Set("Authorization", "Bearer "+deviceToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making request to server: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Server returned non-OK status: %s\n", resp.Status)
		body := new(bytes.Buffer)
		body.ReadFrom(resp.Body)
		fmt.Printf("Response body: %s\n", body.String())
		return
	}

	var regResponse RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResponse); err != nil {
		fmt.Printf("Error decoding response body: %v\n", err)
		return
	}

	fmt.Printf("Successfully registered stream. Topic: %s, SSRC: %d\n", topic, regResponse.Ssrc)

	rtpURL := fmt.Sprintf("rtp://127.0.0.1:%d", regResponse.RtpPort)
	fmt.Printf("Starting ffmpeg stream to: %s\n", rtpURL)

	cmd := exec.Command(
		"ffmpeg",
		"-re",
		"-i", "./sample.mp4",
		"-an",
		"-map", "0:v:0",
		"-c:v", "libx264",
		"-pix_fmt", "yuv420p",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-payload_type", "102",
		"-ssrc", fmt.Sprintf("%d", regResponse.Ssrc),
		"-f", "rtp",
		rtpURL,
	)

	out, err := cmd.CombinedOutput()
	fmt.Printf("ffmpeg output:\n%s\n", out)
	if err != nil {
		fmt.Printf("ffmpeg error: %v\n", err)
	}
}