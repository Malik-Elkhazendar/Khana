export interface OwnerSignupDto {
  workspaceName: string;
  workspaceSlug?: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface TenantResolveResponseDto {
  id: string;
  name: string;
  slug: string;
}
