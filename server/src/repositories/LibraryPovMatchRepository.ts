import { DatabaseRepository } from './DatabaseRepository';
import { LibraryPovMatch, LibraryPov, LibraryAccessLevel, InitialAlignment, CharacterType } from '../types/library';

export class LibraryPovMatchRepository {
  public async getPovsByMatchId(matchId: string): Promise<LibraryPov[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryPov[]>(
      'SELECT id, matchId, name, sectaUserId, initialAlignment, character, characterType, youtubeUrl, youtubeId, position FROM library_povs WHERE matchId = ? ORDER BY position ASC, createdAt ASC',
      [matchId]
    );
  }

  public async getAllPovs(): Promise<LibraryPov[]> {
    const db = await DatabaseRepository.getInstance();
    return db.all<LibraryPov[]>(
      'SELECT id, matchId, name, sectaUserId, initialAlignment, character, characterType, youtubeUrl, youtubeId, position FROM library_povs ORDER BY position ASC, createdAt ASC'
    );
  }

  public async getPovMatchById(id: string): Promise<LibraryPovMatch | undefined> {
    const db = await DatabaseRepository.getInstance();
    const item = await db.get<any>(
      "SELECT id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt FROM library_items WHERE id = ? AND itemType = 'pov_match'",
      [id]
    );
    if (!item) return undefined;
    const povs = await this.getPovsByMatchId(id);
    return {
      ...item,
      allowedRoles: item.allowedRoles ? JSON.parse(item.allowedRoles) : [],
      povs
    };
  }

  public async getAllPovMatches(): Promise<LibraryPovMatch[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      "SELECT id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt FROM library_items WHERE itemType = 'pov_match' ORDER BY position ASC, createdAt ASC"
    );
    const allPovs = await this.getAllPovs();
    const povsByMatch = new Map<string, LibraryPov[]>();
    for (const pov of allPovs) {
      if (!povsByMatch.has(pov.matchId)) {
        povsByMatch.set(pov.matchId, []);
      }
      povsByMatch.get(pov.matchId)!.push(pov);
    }

    return rows.map(row => ({
      ...row,
      allowedRoles: row.allowedRoles ? JSON.parse(row.allowedRoles) : [],
      povs: povsByMatch.get(row.id) || []
    }));
  }

  public async createPovMatch(
    id: string,
    sectionId: string,
    title: string,
    description: string | undefined,
    position: number = 0,
    accessLevel: LibraryAccessLevel = 'all',
    allowedRoles: string[] = [],
    povs: Array<{
      id: string;
      name: string;
      sectaUserId?: string | null;
      initialAlignment: InitialAlignment;
      character: string;
      characterType: CharacterType;
      youtubeUrl: string;
      youtubeId?: string | null;
      position: number;
    }> = []
  ): Promise<LibraryPovMatch> {
    const db = await DatabaseRepository.getInstance();
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        "INSERT INTO library_items (id, sectionId, itemType, title, description, position, accessLevel, allowedRoles) VALUES (?, ?, 'pov_match', ?, ?, ?, ?, ?)",
        [id, sectionId, title, description || null, position, accessLevel, JSON.stringify(allowedRoles)]
      );

      await db.run(
        'INSERT INTO library_pov_matches (itemId) VALUES (?)',
        [id]
      );

      for (const pov of povs) {
        await db.run(
          'INSERT INTO library_povs (id, matchId, name, sectaUserId, initialAlignment, character, characterType, youtubeUrl, youtubeId, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            pov.id,
            id,
            pov.name,
            pov.sectaUserId || null,
            pov.initialAlignment,
            pov.character,
            pov.characterType,
            pov.youtubeUrl,
            pov.youtubeId || null,
            pov.position
          ]
        );
      }

      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }

    const created = await this.getPovMatchById(id);
    return created!;
  }

  public async updatePovMatch(
    id: string,
    sectionId?: string,
    title?: string,
    description?: string,
    position?: number,
    accessLevel?: LibraryAccessLevel,
    allowedRoles?: string[],
    povs?: Array<{
      id: string;
      name: string;
      sectaUserId?: string | null;
      initialAlignment: InitialAlignment;
      character: string;
      characterType: CharacterType;
      youtubeUrl: string;
      youtubeId?: string | null;
      position: number;
    }>
  ): Promise<LibraryPovMatch | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getPovMatchById(id);
    if (!current) return undefined;

    const newSectionId = sectionId !== undefined ? sectionId : current.sectionId;
    const newTitle = title !== undefined ? title : current.title;
    const newDesc = description !== undefined ? description : current.description;
    const newPos = position !== undefined ? position : current.position;
    const newAccessLevel = accessLevel !== undefined ? accessLevel : (current.accessLevel || 'all');
    const newAllowedRoles = allowedRoles !== undefined ? allowedRoles : (current.allowedRoles || []);

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        "UPDATE library_items SET sectionId = ?, title = ?, description = ?, position = ?, accessLevel = ?, allowedRoles = ? WHERE id = ? AND itemType = 'pov_match'",
        [newSectionId, newTitle, newDesc || null, newPos, newAccessLevel, JSON.stringify(newAllowedRoles), id]
      );

      if (povs !== undefined) {
        await db.run('DELETE FROM library_povs WHERE matchId = ?', [id]);
        for (const pov of povs) {
          await db.run(
            'INSERT INTO library_povs (id, matchId, name, sectaUserId, initialAlignment, character, characterType, youtubeUrl, youtubeId, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              pov.id,
              id,
              pov.name,
              pov.sectaUserId || null,
              pov.initialAlignment,
              pov.character,
              pov.characterType,
              pov.youtubeUrl,
              pov.youtubeId || null,
              pov.position
            ]
          );
        }
      }

      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }

    return this.getPovMatchById(id);
  }

  public async deletePovMatch(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run("DELETE FROM library_items WHERE id = ? AND itemType = 'pov_match'", [id]);
    return (result.changes ?? 0) > 0;
  }
}
