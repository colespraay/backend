export enum NODE_ENVIRONMENT {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}
export const NODE_ENV = process.env.NODE_ENV ?? NODE_ENVIRONMENT.DEVELOPMENT;

export const DefaultPassportLink = {
  male: 'https://ik.imagekit.io/cmz0p5kwiyok/public-images/male-icon_LyevsSXsx.png?updatedAt=1641364918016',
  female:
    'https://ik.imagekit.io/cmz0p5kwiyok/public-images/female-icon_MeVg4u34xW.png?updatedAt=1641364923710',
};

export enum DecodedTokenKey {
  USER_ID = 'id',
  EMAIL = 'email',
  ROLE = 'role',
  VIRTUAL_ACCOUNT_NAME = 'virtualAccountName',
  VIRTUAL_ACCOUNT_NUMBER = 'virtualAccountNumber',
  BANK_NAME = 'bankName',
  AUTH_PROVIDER = 'authProvider',
  TOKEN_INITIALIZED_ON = 'iat',
  TOKEN_EXPIRES_IN = 'exp',
  USER = 'user',
}

export enum PaymentStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum RequestStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  FACEBOOK = 'FACEBOOK',
  GOOGLE = 'GOOGLE',
}

export enum AppRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum TransactionType {
  DEBIT = 'Debit',
  CREDIT = 'Credit',
}

export enum EventCategory {
  WEDDING = 'WEDDING',
  BIRTHDAY = 'BIRTHDAY',
  ANNIVERSARY = 'ANNIVERSARY',
  CHURCH_PROGRAM = 'CHURCH_PROGRAM',
  CHILD_DEDICATION = 'CHILD_DEDICATION',
  OTHER = 'OTHER',
}

export enum NotificationType {
  PUSH_NOTIFICATION = 'PUSH_NOTIFICATION',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum NotificationPurpose {
  EVENT_INVITE = 'EVENT_INVITE',
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  PAST = 'PAST',
}

export enum AirtimeProvider {
  MTN = 'MTN',
  NINE_MOBILE = '9MOBILE',
  GLO = 'GLO',
  AIRTEL = 'AIRTEL',
}
