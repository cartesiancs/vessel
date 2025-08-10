package main

import (
	"fmt"
	"os/exec"
)

func main() {
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
		"-f", "rtp",
		"udp://127.0.0.1:5004",
	)
	out, err := cmd.CombinedOutput()
	fmt.Printf("ffmpeg output:\n%s\n", out)
	if err != nil {
		fmt.Printf("ffmpeg error: %v\n", err)
	}
}