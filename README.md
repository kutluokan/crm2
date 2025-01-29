# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

## Deployment

### Supabase Deployment

1. Make sure you have a Supabase project created at [Supabase Dashboard](https://app.supabase.io)
2. Get your project reference ID from the project settings
3. Link your local project:
   ```bash
   npx supabase link --project-ref your-project-ref
   ```
4. Push your database changes:
   ```bash
   npx supabase db push
   ```
5. Deploy Edge Functions (if any):
   ```bash
   npx supabase functions deploy ticket-agent
   ```
6. Deploy your frontend to Vercel or Amplify (see AWS Amplify Deployment below)

Note: Make sure you have the latest Supabase CLI installed:
```bash
npm install supabase --save-dev
```

### AWS Amplify Deployment

1. Install AWS Amplify CLI:
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. Configure AWS credentials:
   ```bash
   amplify configure
   ```

3. Initialize Amplify in your project:
   ```bash
   amplify init
   ```

4. Deploy to Amplify:
   - Push your code to a Git repository (GitHub, GitLab, or BitBucket)
   - Connect your repository in the AWS Amplify Console
   - Amplify will automatically build and deploy your app using the `amplify.yml` configuration

### Environment Variables

Make sure to set these environment variables in both Supabase and AWS Amplify:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_LANGCHAIN_API_KEY=your_langchain_api_key
VITE_LANGCHAIN_PROJECT=your_langchain_project
```

Note: Never commit sensitive environment variables to your repository.
