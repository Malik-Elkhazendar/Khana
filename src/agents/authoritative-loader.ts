import { tool } from '@openai/agents';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

type RouterMap = Record<string, string[]>;

export type LoadedFile = {
  path: string;
  content?: string;
  error?: string;
};

export type AuthoritativeLoadResult = {
  status: 'success' | 'partial' | 'error';
  requestedTags: string[];
  resolvedTags: string[];
  missingTags: string[];
  files: LoadedFile[];
  error?: string;
};

const parseRouter = (content: string): RouterMap => {
  const map: RouterMap = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const tag = trimmed.slice(0, colonIndex).trim();
    const rest = trimmed.slice(colonIndex + 1).trim();
    if (!tag || !rest) continue;

    const files = rest
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (files.length > 0) {
      map[tag] = files;
    }
  }

  return map;
};

const safeRead = (absolutePath: string): LoadedFile => {
  try {
    return { path: absolutePath, content: readFileSync(absolutePath, 'utf8') };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { path: absolutePath, error: message };
  }
};

const toRepoPath = (basePath: string, absolutePath: string): string => {
  const normalized = absolutePath.replace(/\\/g, '/');
  const baseNormalized = basePath.replace(/\\/g, '/');
  if (normalized.startsWith(baseNormalized + '/')) {
    return normalized.slice(baseNormalized.length + 1);
  }
  return normalized;
};

const resolveAuthoritativeDocs = (tags: string[]): AuthoritativeLoadResult => {
  const basePath = process.cwd();
  const rootPath = join(basePath, 'docs', 'authoritative', 'ROOT.md');
  const routerPath = join(basePath, 'docs', 'authoritative', 'ROUTER.md');

  const rootFile = safeRead(rootPath);
  const routerFile = safeRead(routerPath);
  const routerMap = routerFile.content ? parseRouter(routerFile.content) : {};

  const requestedTags = tags ?? [];
  const resolvedTags: string[] = [];
  const missingTags: string[] = [];
  const filesToLoad = new Set<string>([rootPath, routerPath]);

  for (const tag of requestedTags) {
    const files = routerMap[tag];
    if (!files) {
      missingTags.push(tag);
      continue;
    }
    resolvedTags.push(tag);
    for (const file of files) {
      filesToLoad.add(join(basePath, file));
    }
  }

  const files = Array.from(filesToLoad).map((absolutePath) => {
    const loaded = safeRead(absolutePath);
    return {
      path: toRepoPath(basePath, loaded.path),
      content: loaded.content,
      error: loaded.error,
    };
  });

  const status = files.some((file) => file.error) ? 'partial' : 'success';

  return {
    status,
    requestedTags,
    resolvedTags,
    missingTags,
    files,
  };
};

export const authoritativeLoader = tool({
  name: 'load_authoritative',
  description:
    'Load docs/authoritative/ROOT.md and ROUTER.md, plus files resolved by ROUTER tags',
  parameters: z.object({
    tags: z
      .array(z.string())
      .default([])
      .describe('ROUTER tags to load (minimal set)'),
  }),
  execute: async ({ tags }) => {
    return JSON.stringify(resolveAuthoritativeDocs(tags ?? []));
  },
});

export const loadAuthoritativeDocs = async (
  tags: string[]
): Promise<AuthoritativeLoadResult> => {
  try {
    return resolveAuthoritativeDocs(tags ?? []);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      requestedTags: tags,
      resolvedTags: [],
      missingTags: tags,
      files: [],
      error: message,
    };
  }
};

export const buildAuthoritativeContext = (
  result: AuthoritativeLoadResult
): string => {
  const header = 'Authoritative docs (loaded via load_authoritative):';
  const contentBlocks = result.files
    .filter((file) => Boolean(file.content))
    .map((file) => `## ${file.path}\n${file.content ?? ''}`);

  return [header, ...contentBlocks].join('\n\n');
};
