package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"

	"github.com/gordonklaus/portaudio"
)

type RegisterRequest struct {
	Topic     string `json:"topic"`
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
	topic := "go_stream_1"
	mediaType := "audio"

	if deviceId == "" || deviceToken == "" {
		log.Fatal("Error: Please set the deviceId and deviceToken variables.")
	}

	reqBody := RegisterRequest{Topic: topic, MediaType: mediaType}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		log.Fatalf("Error marshalling request body: %v\n", err)
	}

	req, err := http.NewRequest("POST", serverURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Fatalf("Error creating request: %v\n", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Device-Id", deviceId)
	req.Header.Set("Authorization", "Bearer "+deviceToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error making request to server: %v\n", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body := new(bytes.Buffer)
		body.ReadFrom(resp.Body)
		log.Fatalf("Server returned non-OK status: %s\nResponse body: %s\n", resp.Status, body.String())
	}

	var regResponse RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResponse); err != nil {
		log.Fatalf("Error decoding response body: %v\n", err)
	}

	fmt.Printf("Successfully registered stream. Topic: %s, SSRC: %d, Port: %d\n", topic, regResponse.Ssrc, regResponse.RtpPort)

	rtpURL := fmt.Sprintf("rtp://127.0.0.1:%d", regResponse.RtpPort)
	fmt.Printf("Starting real-time audio stream to: %s\n", rtpURL)

	portaudio.Initialize()
	defer portaudio.Terminate()

	host, err := portaudio.DefaultHostApi()
	if err != nil {
		log.Fatal("Host API fail:", err)
	}
	dev := host.DefaultInputDevice
	sampleRate := float64(dev.DefaultSampleRate)
	log.Printf("Using input device %q, sample rate: %.0f Hz", dev.Name, sampleRate)

	framesPerBuffer := int(sampleRate / 50) 
	in := make([]int16, framesPerBuffer)
	stream, err := portaudio.OpenDefaultStream(1, 0, sampleRate, len(in), &in)
	if err != nil {
		log.Fatal(err)
	}
	if err := stream.Start(); err != nil {
		log.Fatal(err)
	}
	defer stream.Stop()

	cmd := exec.Command(
		"ffmpeg",
		"-f", "s16le",
		"-ar", fmt.Sprintf("%d", int(sampleRate)),
		"-ac", "1",
		"-i", "pipe:0",
		"-vn",
		"-c:a", "libopus",
		"-b:a", "64k",
		"-vbr", "on",
		"-compression_level", "10",
		"-payload_type", "96",
		"-ssrc", fmt.Sprintf("%d", int32(regResponse.Ssrc)),
		"-f", "rtp",
		rtpURL,
	)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		log.Fatal(err)
	}
	cmd.Stderr = log.Writer()

	if err := cmd.Start(); err != nil {
		log.Fatal(err)
	}
	defer cmd.Process.Kill()

	buf := make([]byte, framesPerBuffer*2)
	fmt.Println("Streaming... Press Ctrl+C to stop.")
	for {
		if err := stream.Read(); err != nil {
			if err == portaudio.InputOverflowed {
				continue
			}
			log.Println("stream read error:", err)
			break
		}
		for i, v := range in {
			buf[2*i] = byte(v)
			buf[2*i+1] = byte(v >> 8)
		}
		if _, err := stdin.Write(buf); err != nil {
			log.Println("stdin write error:", err)
			break
		}
	}

	if err := cmd.Wait(); err != nil {
		log.Printf("ffmpeg command finished with error: %v", err)
	}
}
