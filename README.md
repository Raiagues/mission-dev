# Norte

Ambiente colaborativo para concepção e engenharia de missões espaciais universitárias.

## Abrir localmente

Use Node `24.20+` e execute:

```bash
cd /home/rodriger/Documents/mission-dev
npm install
npm run dev
```

- Site: `http://127.0.0.1:5173/norte/`
- Swagger: `http://127.0.0.1:8787/docs`

A primeira conta criada vira proprietária/admin. As próximas contas podem ser criadas diretamente; quando um e-mail já foi adicionado a uma equipe, o novo perfil é associado a ela automaticamente.

## Publicações

### GitHub Pages

Cada atualização da `main` publica automaticamente uma demonstração navegável. Ela guarda alterações somente no navegador, usa perfis demonstrativos e não possui contas compartilhadas nem Gemini remoto.

[https://raiagues.github.io/norte/](https://raiagues.github.io/norte/)

### Norte completo

A versão real serve frontend e API no mesmo endereço HTTPS, usa PostgreSQL e chama o Gemini apenas no servidor. A implantação é feita pelas telas do Neon e do Render, sem comandos:

1. Crie um projeto gratuito no [Neon](https://console.neon.tech/) e copie a connection string **pooled**.
2. Abra [Deploy to Render](https://render.com/deploy?repo=https://github.com/Raiagues/norte).
3. Em `DATABASE_URL`, cole a connection string do Neon.
4. Em `GEMINI_API_KEY`, cole a chave criada no [Google AI Studio](https://aistudio.google.com/app/apikey).
5. Confirme a implantação e abra o endereço `onrender.com` criado pelo Render.
6. Cadastre a primeira conta; ela será a proprietária/admin da equipe.

O plano gratuito do Neon não tem prazo de expiração e escala a zero quando ocioso. O serviço web gratuito do Render pode hibernar sem uso, então a primeira abertura pode levar um pouco mais de tempo.

Veja o passo a passo e as decisões de produção em [docs/deployment.md](docs/deployment.md).

## Qualidade e segurança

```bash
npm run quality
npm run security:secrets
npm run security:audit
```

O GitHub executa automaticamente:

- tipagem TypeScript, ESLint, testes de frontend e API e build de produção;
- auditoria de dependências e varredura de segredos;
- CodeQL para JavaScript/TypeScript;
- revisão de dependências em pull requests;
- Dependabot semanal para npm e GitHub Actions;
- CD do GitHub Pages somente depois do build validado.

Leia [docs/security.md](docs/security.md) antes de armazenar dados reais de uma equipe.
