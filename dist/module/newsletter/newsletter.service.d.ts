import { INewsletterService } from "./newsletter.interface";
import { NewsletterSubscriber, NewsletterStats } from "./newsletter.type";
export declare class NewsletterService implements INewsletterService {
    subscribeNewsletter(email: string, userId?: string): Promise<NewsletterSubscriber>;
    getAllSubscribers(): Promise<NewsletterSubscriber[]>;
    deleteSubscriber(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getNewsletterStats(period?: string, startDate?: string, endDate?: string): Promise<NewsletterStats>;
}
export declare const newsletterService: NewsletterService;
//# sourceMappingURL=newsletter.service.d.ts.map