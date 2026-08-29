import { DatabaseRepository } from './DatabaseRepository';
import { BaseLibraryItem, LibraryAccessLevel, LibraryItem, LibrarySection } from '../types/library';

const SECTION_COLUMNS = 'id, name, parentId, position, icon, accessLevel, allowedRoles, createdAt';

export class LibraryItemRepository {
  private mapSection(row: any): LibrarySection {
    return {
      ...row,
      icon: row.icon || null,
      accessLevel: row.accessLevel || 'all',
      allowedRoles: row.allowedRoles ? JSON.parse(row.allowedRoles) : []
    };
  }

  // --- SECCIONES ---
  public async getAllSections(): Promise<LibrarySection[]> {
    const db = await DatabaseRepository.getInstance();
    const rows = await db.all<any[]>(
      `SELECT ${SECTION_COLUMNS} FROM library_sections ORDER BY position ASC, createdAt ASC`
    );
    return rows.map(r => this.mapSection(r));
  }

  public async getSectionById(id: string): Promise<LibrarySection | undefined> {
    const db = await DatabaseRepository.getInstance();
    const row = await db.get<any>(
      `SELECT ${SECTION_COLUMNS} FROM library_sections WHERE id = ?`,
      [id]
    );
    return row ? this.mapSection(row) : undefined;
  }

  public async createSection(
    id: string,
    name: string,
    parentId: string | null,
    position: number,
    accessLevel: LibraryAccessLevel = 'all',
    allowedRoles: string[] = [],
    icon: string | null = null
  ): Promise<LibrarySection> {
    const db = await DatabaseRepository.getInstance();
    await db.run(
      'INSERT INTO library_sections (id, name, parentId, position, icon, accessLevel, allowedRoles) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, parentId, position, icon, accessLevel, JSON.stringify(allowedRoles || [])]
    );
    const created = await this.getSectionById(id);
    return created!;
  }

  public async updateSection(
    id: string,
    name?: string,
    parentId?: string | null,
    position?: number,
    accessLevel?: LibraryAccessLevel,
    allowedRoles?: string[],
    icon?: string | null
  ): Promise<LibrarySection | undefined> {
    const db = await DatabaseRepository.getInstance();
    const current = await this.getSectionById(id);
    if (!current) return undefined;

    const newName = name !== undefined ? name : current.name;
    const newParentId = parentId !== undefined ? parentId : current.parentId;
    const newPosition = position !== undefined ? position : current.position;
    const newAccessLevel = accessLevel !== undefined ? accessLevel : (current.accessLevel || 'all');
    const newAllowedRoles = allowedRoles !== undefined ? allowedRoles : (current.allowedRoles || []);
    const newIcon = icon !== undefined ? icon : (current.icon ?? null);

    await db.run(
      'UPDATE library_sections SET name = ?, parentId = ?, position = ?, icon = ?, accessLevel = ?, allowedRoles = ? WHERE id = ?',
      [newName, newParentId, newPosition, newIcon, newAccessLevel, JSON.stringify(newAllowedRoles), id]
    );
    return this.getSectionById(id);
  }

  public async deleteSection(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM library_sections WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  public async countSubItems(sectionId: string): Promise<number> {
    const db = await DatabaseRepository.getInstance();
    const query = `
      WITH RECURSIVE section_tree(id) AS (
        SELECT id FROM library_sections WHERE id = ?
        UNION ALL
        SELECT s.id FROM library_sections s
        JOIN section_tree st ON s.parentId = st.id
      )
      SELECT COUNT(*) as count
      FROM library_items
      WHERE sectionId IN (SELECT id FROM section_tree)
    `;
    const row = await db.get<{ count: number }>(query, [sectionId]);
    return row ? row.count : 0;
  }

  // --- BASE LIBRARY ITEMS ---
  public async getAllRawItems(): Promise<BaseLibraryItem[]> {
    const db = await DatabaseRepository.getInstance();
    const items = await db.all<any[]>(
      'SELECT id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt FROM library_items ORDER BY position ASC, createdAt ASC'
    );
    return items.map(i => ({
      ...i,
      allowedRoles: i.allowedRoles ? JSON.parse(i.allowedRoles) : []
    }));
  }

  public async getItemById(id: string): Promise<BaseLibraryItem | undefined> {
    const db = await DatabaseRepository.getInstance();
    const item = await db.get<any>(
      'SELECT id, sectionId, itemType, title, description, position, accessLevel, allowedRoles, createdAt FROM library_items WHERE id = ?',
      [id]
    );
    if (!item) return undefined;
    return {
      ...item,
      allowedRoles: item.allowedRoles ? JSON.parse(item.allowedRoles) : []
    };
  }

  public async deleteItem(id: string): Promise<boolean> {
    const db = await DatabaseRepository.getInstance();
    const result = await db.run('DELETE FROM library_items WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }
}
