import { TwitterRepository } from '../repositories/TwitterRepository';
import { InstagramRepository } from '../repositories/InstagramRepository';

export class SocialMediaService {
  constructor(
    private twitterRepository: TwitterRepository,
    private instagramRepository: InstagramRepository
  ) {}

  async publishToTwitter(message: string): Promise<boolean> {
    return await this.twitterRepository.publish(message);
  }

  async publishToInstagram(message: string): Promise<boolean> {
    return await this.instagramRepository.publish(message);
  }
}
