export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type ProfileSnapshot = {
  isDeveloper: boolean;
  timezone: string;
  briefingHourLocal: number;
  interests: string[];
  stackTags: string[];
  projectsDescription: string | null;
  followedRepos: string[];
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  onboardingCompletedAt: Date | null;
};
