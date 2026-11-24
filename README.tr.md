> 🚧 **Durum: aktif geliştirme.** Yazarın kullanımında çalışıyor; arayüzler değişebilir.

# llm-balance-monitor

[English README](README.md)

Birkaç LLM API sağlayıcısının (DeepSeek, Moonshot/Kimi, OpenRouter) ön ödemeli bakiyesini kontrol eden küçük bir betik. Son kontrolleri bir JSON dosyasında tutar, bakiye eşiğin altına düşerse uyarı yazar. Çıkış kodu `2` "en az bir uyarı var" demektir; zamanlayıcı bununla sizi haberdar edebilir.

## Neden

Ön ödemeli API kredisi en kötü anda biter. Bu betik günde bir kez bakar ve bitmeden önce söyler; panel ya da servis gerekmez.

## Hızlı başlangıç

Gereksinim: [Bun](https://bun.sh) (ya da TypeScript'i doğrudan çalıştırabilen Node.js 22.18+ / 24). Zamanlama yardımcıları (`run-check.cmd`, `install-balance-cron.ps1`) yalnız Windows içindir; betiğin kendisi her platformda çalışır.

```sh
# yalnız kullandığınız sağlayıcıların anahtarını verin
export DEEPSEEK_API_KEY=...        # PowerShell: $env:DEEPSEEK_API_KEY = "..."
export OPENROUTER_API_KEY=...
bun run check-balances.ts
```

Anahtarları depo dışında bir dosyada tutup yolunu da verebilirsiniz (`.env.example` örneğine bakın):

```sh
LLM_MONITOR_ENV_FILE=/yol/keys.env bun run check-balances.ts
```

Durum dosyası `./data/balance-state.json` yoluna yazılır (`LLM_MONITOR_DATA_DIR` ile değişir); son 90 kontrol saklanır.

## Yapılandırma

| Değişken | Anlamı |
|---|---|
| `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `OPENROUTER_API_KEY` | Sağlayıcı anahtarları. Anahtarı olmayan sağlayıcı hata olarak raporlanır ve atlanır. |
| `LLM_MONITOR_ENV_FILE` | Anahtarların okunacağı isteğe bağlı `.env` türü dosya. Gerçek ortam değişkenleri önceliklidir. |
| `LLM_MONITOR_DATA_DIR` | `balance-state.json` klasörü (varsayılan `./data`). |
| `MOONSHOT_BASE_URL` | Varsayılan `https://api.moonshot.ai` (uluslararası, USD). Çin platformu için `https://api.moonshot.cn` (CNY). İki platformun anahtarları farklıdır. |

Eşikler `lib.ts` içindeki `THRESHOLDS` değerindedir: DeepSeek ve Moonshot 3 USD altında uyarı, 1 USD altında kritik; OpenRouter 5 USD altında uyarı, 1 USD altında kritik.

## Windows'ta günlük çalıştırma

```powershell
powershell -ExecutionPolicy Bypass -File install-balance-cron.ps1
```

Her gün 09:00'da `run-check.cmd` çalıştıran bir Görev Zamanlayıcı kaydı açar. `bun` PATH'te değilse `BUN_PATH` ile `bun.exe` yolunu verin. Kaldırmak için: `schtasks /delete /tn "LLM Balance Monitor" /f`.

## Testler

```sh
node --test tests/*.test.ts
```

Testler sahte `fetch` kullanır; sağlayıcıya bağlanmaz, anahtar gerekmez. Ayrıca kaynakta TLS doğrulamasının kapatılmadığını denetler.

## Güvenlik notları

- Anahtarlar ortam değişkeninden ya da verdiğiniz dosyadan okunur; depoda hiçbir anahtar yoktur. Durum dosyası yalnız bakiye içerir.
- TLS sertifikaları her zaman doğrulanır. Bir makinede TLS hatası alırsanız doğrulamayı kapatmak yerine sertifika deposunu düzeltin.

## Sınırlar ve doğrulanmamış iddialar

- Sağlayıcı yanıt biçimleri yazarın son kullandığı zamanda doğruydu; sağlayıcılar haber vermeden değiştirebilir. Testler yalnız beklenen yanıt biçimlerinin ayrıştırılmasını (sahte yanıtlarla) kapsar, canlı API'leri değil.
- Yalnız DeepSeek, Moonshot ve OpenRouter desteklenir. Herkese açık bakiye uç noktası olmayanlar (ör. MiniMax, Z.ai) kontrol edilmez.
- Yerleşik bildirim yok (e-posta, sohbet, push). Çıkış kodunu ve günlüğü kullanın.
- Yazar yalnız Windows'ta denedi; Linux/macOS çalıştırması beklenir ama yalnız CI'daki birim testleriyle kapsanır.

## Lisans

Apache-2.0, bkz. [LICENSE](LICENSE) ve [NOTICE](NOTICE).
