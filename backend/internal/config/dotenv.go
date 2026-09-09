package config

import (
	"bufio"
	"os"
	"strings"
)

// loadDotenv reads KEY=VALUE lines from .env into the process environment,
// without overwriting variables already set (so `FOO=bar go run ...` still
// wins over the file). Missing file is not an error — .env is optional,
// real deployments set real environment variables instead.
func loadDotenv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}
