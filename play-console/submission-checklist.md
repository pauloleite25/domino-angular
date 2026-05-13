# Submission checklist

## Required before upload

- [ ] Conta da Play Console verificada
- [ ] App criado como `Game > Board`
- [ ] E-mail de suporte preenchido
- [ ] URL publica da politica de privacidade definida
- [ ] Politica publicada em `https://SEU_DOMINIO/assets/legal/privacy-policy.html`
- [ ] Icone `512 x 512`
- [ ] Feature graphic `1024 x 500`
- [ ] Pelo menos 2 screenshots reais do app
- [ ] Declaracao de `Data safety` revisada com base no backend real
- [ ] Questionario de `Content rating` preenchido
- [ ] Campo `Ads` marcado corretamente
- [ ] Campo `App access` preenchido com o texto de `review-notes.md`

## Android artifact

- [ ] Upload do arquivo `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] Confirmar `package name`: `br.com.dominomesa.app`
- [ ] Confirmar `versionCode`: `1`
- [ ] Confirmar `versionName`: `1.0.0`

## Release path

1. Subir primeiro em `Internal testing`
2. Validar instalacao e abertura em aparelho real
3. Se sua conta pessoal estiver sujeita a isso, cumprir `Closed testing` com `12 testers` por `14 dias continuos`
4. So depois enviar para `Production`

## Files you must keep safe

- `android/domino-upload-key.jks`
- `android/key.properties`

Sem essa mesma chave de upload, futuras atualizacoes do app podem ficar bloqueadas.
