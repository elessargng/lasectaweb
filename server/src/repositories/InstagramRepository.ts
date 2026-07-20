export class InstagramRepository {
  async publish(message: string): Promise<boolean> {
    console.log(`[InstagramRepository] (Mock) Publicando en Instagram: "${message}"`);
    return true;
  }
}
