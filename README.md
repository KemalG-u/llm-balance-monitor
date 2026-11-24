> 🚧 **Status: active development.** It works for the author; interfaces may change.

# llm-balance-monitor

[Türkçe README](README.tr.md)

A small script that checks the prepaid balance of a few LLM API providers (DeepSeek, Moonshot/Kimi, OpenRouter), keeps a rolling history in a JSON file, and prints a warning when a balance falls below a threshold. Exit code `2` means "at least one alert", so a scheduler can notify you.

## Why

Prepaid API credit runs out at the worst moment. This checks once a day and tells you before it does, without a dashboard or a service.

## Quick start

Requirements: [Bun](https://bun.sh) (or Node.js 22.18+ / 24, which can run TypeScript directly). The scheduling helpers (`run-check.cmd`, `install-balance-cron.ps1`) are Windows-only; the script itself is cross-platform.

```sh
# set only the keys of the providers you use
export DEEPSEEK_API_KEY=...        # PowerShell: $env:DEEPSEEK_API_KEY = "..."
export OPENROUTER_API_KEY=...
bun run check-balances.ts
```

Or keep the keys in a file outside the repository and point to it (see `.env.example`):

```sh
LLM_MONITOR_ENV_FILE=/path/to/keys.env bun run check-balances.ts
```

Example output (numbers are illustrative):

```
=== LLM balances: 2026-01-01T09:00:00.000Z ===
  WARNING deepseek: 1.97 USD (below 3)
  openrouter: no fixed limit (pay-as-you-go)
  moonshot: ERROR HTTP 401

--- 2 alert(s) ---
```

The state file is written to `./data/balance-state.json` (override with `LLM_MONITOR_DATA_DIR`). It keeps the last 90 checks.

## Configuration

| Variable | Meaning |
|---|---|
| `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `OPENROUTER_API_KEY` | Provider keys. A provider without a key is reported as an error and skipped. |
| `LLM_MONITOR_ENV_FILE` | Optional `.env`-style file to read keys from. Real environment variables take precedence. |
| `LLM_MONITOR_DATA_DIR` | Directory for `balance-state.json` (default `./data`). |
| `MOONSHOT_BASE_URL` | Default `https://api.moonshot.ai` (international, USD). Use `https://api.moonshot.cn` for the China platform (CNY). The two platforms use different keys. |

Thresholds are defined in `lib.ts` (`THRESHOLDS`): DeepSeek and Moonshot warn below 3 and are critical below 1 USD; OpenRouter warns below 5 and is critical below 1 USD. OpenRouter keys without a spending limit report "no fixed limit". A balance in another currency (for example CNY on the China Moonshot platform) is not compared with these USD thresholds; the monitor reports a warning that it was not compared.

## Daily schedule on Windows

```powershell
powershell -ExecutionPolicy Bypass -File install-balance-cron.ps1
```

Registers a Task Scheduler entry that runs `run-check.cmd` every day at 09:00 (output in `%TEMP%\llm-balance-check.log`). If `bun` is not on `PATH`, set `BUN_PATH` to the full path of `bun.exe`. Remove with `schtasks /delete /tn "LLM Balance Monitor" /f`.

## Tests

```sh
node --test tests/*.test.ts
```

The tests use a fake `fetch`; they never contact a provider and need no keys. They also check that TLS verification is not disabled anywhere in the source.

## Security notes

- API keys are read from the environment or a file you point to; nothing is stored in the repository, and the state file contains balances only, not keys.
- TLS certificates are always verified. If your runtime fails TLS on some machine, fix the certificate store instead of disabling verification.

## Limits and unverified claims

- The provider response formats were correct when the author last used them; providers can change them without notice. Only parsing of the expected shapes is covered by tests (with fake responses), not the live APIs.
- Only DeepSeek, Moonshot and OpenRouter are supported. Providers without a public balance endpoint (for example MiniMax, Z.ai) are not checked.
- No notifications are built in (no email, chat, push). Use the exit code and the log.
- Tested by the author on Windows only; Linux/macOS run of the script is expected to work but is covered only by the unit tests in CI.

## License

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
