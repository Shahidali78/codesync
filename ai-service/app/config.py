from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=False)

    ollama_url: str = "http://localhost:11434"
    ai_model_heavy: str = "qwen2.5-coder:7b"    # review / explain / fix
    ai_model_light: str = "qwen2.5-coder:1.5b"  # autocomplete


settings = Settings()
