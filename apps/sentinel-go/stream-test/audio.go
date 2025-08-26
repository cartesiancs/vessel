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
}

type RegisterResponse struct {
	Ssrc   uint32 `json:"ssrc"`
	RtpPort uint16 `json:"rtp_port"`
}

func main() {
    deviceId := "audio"
    deviceToken := "FnhXd7dNy8iCPbu5N5jS2v_NaOYCiI9AqPO4FQQed7E"

    serverURL := "http://127.0.0.1:8080/api/streams/register"
    topic := "go_stream_1"

    if deviceId == "" || deviceToken == "" {
        fmt.Println("Error: Please set the deviceId and deviceToken variables.")
        return
    }

    reqBody := RegisterRequest{Topic: topic}
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

    rtpURL := fmt.Sprintf("rtp://127.0.0.1:%d?ssrc=%d", regResponse.RtpPort, regResponse.Ssrc)
    fmt.Printf("Starting ffmpeg stream to: %s\n", rtpURL)

	cmd := exec.Command(
		"ffmpeg",
		"-re",
		"-i", "./sample.mp3",
		"-vn",
		"-map", "0:a:0",
		"-c:a", "libopus",
		"-b:a", "64k",
		"-vbr", "on",
		"-compression_level", "10",
		"-payload_type", "96",
		"-fflags", "nobuffer",
		"-flags", "low_delay",
		"-flush_packets", "1",
		"-muxdelay", "0",
		"-ssrc",  fmt.Sprintf("%d", int32(regResponse.Ssrc)),
		"-f", "rtp",
		rtpURL,
	)

	out, err := cmd.CombinedOutput()
	fmt.Printf("ffmpeg output:\n%s\n", out)
	if err != nil {
		fmt.Printf("ffmpeg error: %v\n", err)
	}
}