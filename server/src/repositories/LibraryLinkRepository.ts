import { DatabaseRepository } from './DatabaseRepository';
import { LibraryLink } from '../types/library';

export class LibraryLinkRepository {
  public async getLinkById(id: string): Promise<LibraryLink | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      `SELECT i.id, i.sectionId, i.itemType, i.title, i.description, i.position, i.accessLevel, i.allowedRoles, i.createdAt,
              l.url, l.linkType, l.thumbnailUrl
       FROM library_items i
       INNER JOIN library_links l ON i.id = l.itemId
       WHERE i.id = ? AND i.itemType = 'link'`,
      [id]
    );
    if (!row) return undefined;
    return {
      ...row,
      allowedRoles: row.allowedRoles ? JSON.parse(row.allowedRoles) : []
    };
  }

  public async getAllLinks(): Promise<LibraryLink[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT i.id, i.sectionId, i.itemType, i.title, i.description, i.position, i.accessLevel, i.allowedRoles, i.createdAt,
              l.url, l.linkType, l.thumbnailUrl
       FROM library_items i
       INNER JOIN library_links l ON i.id = l.itemId
       WHERE i.itemType = 'link'
       ORDER BY i.position ASC, i.createdAt ASC`
    );
    return rows.map(row => ({
      ...row,
      allowedRoles: row.allowedRoles ? JSON.parse(row.allowedRoles) : []
    }));
  }

  public async createLink(
    id: string,
    sectionId: string,
    title: string,
    url: string,
    linkType: 'normal' | 'youtube',
    thumbnailUrl?: string,
    description?: string,
    position: number = 0,
    accessLevel: 'all' | 'registered' | 'roles' = 'all',
    allowedRoles: string[] = []
  ): Promise<LibraryLink> {
    const db = await DatabaseRepository.getInstance();
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        "INSERT INTO library_items (id, sectionId, itemType, title, description, position, accessLevel, allowedRoles) VALUES (?, ?, 'link', ?, ?, ?, ?, ?)",
        [id, sectionId, title, description || null, position, accessLevel, JSON.stringify(allowedRoles)]
      );

      await db.run(
        'INSERT INTO library_links (itemId, url, linkType, thumbnailUrl) VALUES (?, ?, ?, ?)',
        [id, url, linkType, thumbnailUrl || null]
      );

      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }

    const created = await this.getLinkById(id);
    return created!;
  }

  public async updateLink(
    id: string,
    sectionId?: string,
    title?: string,
    url?: string,
    linkType?: 'normal' | 'youtube',
    thumbnailUrl?: string,
    description?: string,
    position?: number,
    accessLevel?: 'all' | 'registered' | 'roles',
    allowedRoles?: string[]
  ): Promise<LibraryLink | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getLinkById(id);
    if (!current) return undefined;

    const newSectionId = sectionId !== undefined ? sectionId : current.sectionId;
    const newTitle = title !== undefined ? title : current.title;
    const newDesc = description !== undefined ? description : current.description;
    const newPos = position !== undefined ? position : current.position;
    const newAccessLevel = accessLevel !== undefined ? accessLevel : (current.accessLevel || 'all');
    const newAllowedRoles = allowedRoles !== undefined ? allowedRoles : (current.allowedRoles || []);

    const newUrl = url !== undefined ? url : current.url;
    const newLinkType = linkType !== undefined ? linkType : current.linkType;
    const newThumbnailUrl = thumbnailUrl !== undefined ? thumbnailUrl : current.thumbnailUrl;

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.run(
        "UPDATE library_items SET sectionId = ?, title = ?, description = ?, position = ?, accessLevel = ?, allowedRoles = ? WHERE id = ? AND itemType = 'link'",
        [newSectionId, newTitle, newDesc || null, newPos, newAccessLevel, JSON.stringify(newAllowedRoles), id]
      );

      await db.run(
        'UPDATE library_links SET url = ?, linkType = ?, thumbnailUrl = ? WHERE itemId = ?',
        [newUrl, newLinkType, newThumbnailUrl || null, id]
      );

      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }

    return this.getLinkById(id);
  }

  public async deleteLink(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run("DELETE FROM library_items WHERE id = ? AND itemType = 'link'", [id]);
    return (result.changes ?? 0) > 0;
  }
}
