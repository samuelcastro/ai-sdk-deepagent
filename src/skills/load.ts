import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SkillMetadata, SkillLoadOptions } from "./types.ts";

/**
 * Parse YAML frontmatter from a SKILL.md file.
 *
 * Expected format:
 * ---
 * name: skill-name
 * description: What this skill does
 * ---
 *
 * # Skill Content
 * ...
 */
export async function parseSkillMetadata(
  skillMdPath: string,
  source: 'user' | 'project'
): Promise<SkillMetadata | null> {
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Match YAML frontmatter between --- delimiters
    const frontmatterPattern = /^---\s*\n(.*?)\n---\s*\n/s;
    const match = content.match(frontmatterPattern);

    if (!match) {
      console.warn(`[Skills] No frontmatter found in ${skillMdPath}`);
      return null;
    }

    const frontmatter = match[1];
    if (!frontmatter) {
      console.warn(`[Skills] Empty frontmatter in ${skillMdPath}`);
      return null;
    }

    // Parse key-value pairs from YAML (simple parsing, no full YAML parser needed)
    const metadata: Record<string, string> = {};
    for (const line of frontmatter.split('\n')) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        if (key && value) {
          metadata[key] = value.trim();
        }
      }
    }

    // Validate required fields
    if (!metadata.name || !metadata.description) {
      console.warn(
        `[Skills] Missing required fields (name, description) in ${skillMdPath}`
      );
      return null;
    }

    return {
      name: metadata.name,
      description: metadata.description,
      path: skillMdPath,
      source,
    };
  } catch (error) {
    console.warn(`[Skills] Failed to parse ${skillMdPath}:`, error);
    return null;
  }
}

/**
 * List all skills in a directory.
 * Scans for subdirectories containing SKILL.md files.
 */
async function listSkillsInDirectory(
  skillsDir: string,
  source: 'user' | 'project'
): Promise<SkillMetadata[]> {
  try {
    // Security: Resolve to prevent path traversal
    const resolvedDir = path.resolve(skillsDir);

    // Check if directory exists
    try {
      const stat = await fs.stat(resolvedDir);
      if (!stat.isDirectory()) {
        return [];
      }
    } catch {
      return []; // Directory doesn't exist
    }

    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    const skills: SkillMetadata[] = [];

    for (const entry of entries) {
      // Skip non-directories and hidden directories
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      // Security: Skip symlinks to prevent traversal attacks
      if (entry.isSymbolicLink()) {
        console.warn(
          `[Skills] Skipping symlink: ${path.join(resolvedDir, entry.name)}`
        );
        continue;
      }

      // Look for SKILL.md in subdirectory
      const skillMdPath = path.join(resolvedDir, entry.name, 'SKILL.md');

      try {
        await fs.access(skillMdPath);
        const metadata = await parseSkillMetadata(skillMdPath, source);
        if (metadata) {
          skills.push(metadata);
        }
      } catch {
        // SKILL.md doesn't exist in this directory, skip
        continue;
      }
    }

    return skills;
  } catch (error) {
    console.warn(`[Skills] Failed to list skills in ${skillsDir}:`, error);
    return [];
  }
}

/**
 * List all skills from user and project directories.
 * Project skills override user skills with the same name.
 */
export async function listSkills(
  options: SkillLoadOptions
): Promise<SkillMetadata[]> {
  const { userSkillsDir, projectSkillsDir } = options;
  const skillsMap = new Map<string, SkillMetadata>();

  // Load user skills first
  if (userSkillsDir) {
    const userSkills = await listSkillsInDirectory(userSkillsDir, 'user');
    for (const skill of userSkills) {
      skillsMap.set(skill.name, skill);
    }
  }

  // Load project skills second (override user skills)
  if (projectSkillsDir) {
    const projectSkills = await listSkillsInDirectory(projectSkillsDir, 'project');
    for (const skill of projectSkills) {
      skillsMap.set(skill.name, skill); // Override user skill if exists
    }
  }

  return Array.from(skillsMap.values());
}
