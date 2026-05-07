export interface OAuthProviderConfig {
  provider:        string;
  displayName:     string;
  description:     string;
  authUrl:         string;
  tokenUrl:        string;
  scopes:          string[];
  clientIdKey:     string;   // SettingsService key for client_id
  clientSecretKey: string;   // SettingsService key for client_secret
  iconUrl?:        string;
  mcpServerUrl?:   string;   // the MCP endpoint this provider exposes
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  canva: {
    provider:        'canva',
    displayName:     'Canva',
    description:     'Generate and edit designs via Canva MCP',
    authUrl:         'https://www.canva.com/api/oauth/authorize',
    tokenUrl:        'https://api.canva.com/rest/v1/oauth/token',
    scopes:          [
      'design:content:read',
      'design:content:write',
      'design:meta:read',
      'asset:read',
      'asset:write',
      'brandtemplate:content:read',
      'brandtemplate:meta:read',
      'profile:read',
    ],
    clientIdKey:     'canva_oauth_client_id',
    clientSecretKey: 'canva_oauth_client_secret',
    mcpServerUrl:    'https://mcp.canva.com/mcp',
  },

  github: {
    provider:        'github',
    displayName:     'GitHub',
    description:     'Access repositories and issues via GitHub MCP',
    authUrl:         'https://github.com/login/oauth/authorize',
    tokenUrl:        'https://github.com/login/oauth/access_token',
    scopes:          ['repo', 'read:user', 'read:org'],
    clientIdKey:     'github_oauth_client_id',
    clientSecretKey: 'github_oauth_client_secret',
    mcpServerUrl:    'https://api.githubcopilot.com/mcp/',
  },
};
