/**
 * Lighthouse CI contra o deploy da Vercel (workflow .github/workflows/lighthouse.yml).
 * Meta do AGENTS.md: 95+ em Performance, Acessibilidade, Boas Práticas e SEO.
 * O preview é protegido: o cabeçalho de bypass (Protection Bypass for Automation) libera o acesso.
 */
const base = (process.env.DEPLOY_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

module.exports = {
	ci: {
		collect: {
			url: [`${base}/`, `${base}/loja`],
			numberOfRuns: 3,
			settings: {
				chromeFlags: '--no-sandbox',
				...(bypass ? { extraHeaders: JSON.stringify({ 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }) } : {}),
			},
		},
		assert: {
			assertions: {
				'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
				'categories:accessibility': ['error', { minScore: 0.95 }],
				'categories:best-practices': ['error', { minScore: 0.95 }],
				'categories:seo': ['error', { minScore: 0.95 }],
			},
		},
		// Relatórios ficam como artefato do workflow (nada é publicado fora do GitHub)
		upload: { target: 'filesystem', outputDir: '.lighthouseci' },
	},
};
