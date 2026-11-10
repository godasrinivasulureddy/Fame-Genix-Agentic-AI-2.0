import sys
import logging
import uvicorn

# Suppress harmless noisy CancelledError tracebacks during Ctrl+C shutdown
logging.getLogger("uvicorn.error").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)

if __name__ == "__main__":
    try:
        uvicorn.run(
            "app.main:app",
            app_dir="backend",
            host="127.0.0.1",
            port=8000,
            reload=True,
            reload_dirs=["backend"],
            log_level="info",
        )
    except KeyboardInterrupt:
        print("\n[FAME-GENIX] Server shut down cleanly.")
        sys.exit(0)
