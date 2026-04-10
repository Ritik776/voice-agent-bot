export enum ConversationState {
  IDLE = "IDLE",
  GREETING = "GREETING",
  CONSENT = "CONSENT",
  DISCOVERY = "DISCOVERY",
  RECOMMENDATION = "RECOMMENDATION",
  EDUCATION = "EDUCATION",
  OBJECTION_HANDLING = "OBJECTION_HANDLING",
  CLOSING = "CLOSING",
  SUCCESS = "SUCCESS",
  SOFT_EXIT = "SOFT_EXIT",
}

export const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.IDLE]: [ConversationState.GREETING],
  [ConversationState.GREETING]: [ConversationState.CONSENT, ConversationState.DISCOVERY],
  [ConversationState.CONSENT]: [ConversationState.DISCOVERY, ConversationState.SOFT_EXIT],
  [ConversationState.DISCOVERY]: [ConversationState.RECOMMENDATION, ConversationState.DISCOVERY],
  [ConversationState.RECOMMENDATION]: [
    ConversationState.EDUCATION,
    ConversationState.OBJECTION_HANDLING,
    ConversationState.CLOSING,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.EDUCATION]: [
    ConversationState.CLOSING,
    ConversationState.OBJECTION_HANDLING,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.OBJECTION_HANDLING]: [
    ConversationState.CLOSING,
    ConversationState.EDUCATION,
    ConversationState.SOFT_EXIT,
  ],
  [ConversationState.CLOSING]: [
    ConversationState.SUCCESS,
    ConversationState.SOFT_EXIT,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.SUCCESS]: [ConversationState.DISCOVERY],
  [ConversationState.SOFT_EXIT]: [ConversationState.DISCOVERY],
};

export interface MatchedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string;
  useCases: string[];
  sellingPoints: string[];
  relevanceScore: number;
  matchReason: string;
}

export interface ConversationResponse {
  message: string;
  products?: MatchedProduct[];
  state: ConversationState;
  language?: string;
}

export interface TriggerConfig {
  type: 'time' | 'scroll' | 'exit_intent' | 'idle' | 'page_specific';
  delay?: number;
  scrollPercent?: number;
  idleTime?: number;
  pages?: string[];
  showOnce?: boolean;
  showOnMobile?: boolean;
}

export interface MerchantConfig {
  name: string;
  greeting: string;
  tone: 'friendly' | 'professional' | 'casual' | 'energetic';
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  triggers: TriggerConfig[];
  enableCoupons: boolean;
  enableVoice: boolean;
}

export interface CouponRules {
  maxDiscountPercent: number;
  minOrderValue: number;
  validForHours: number;
  maxUsage: number;
  onlyForProducts?: string[];
  prefix: string;
}
