
export const LOGIN_STRINGS = {
  LOGIN_TITLE: 'KarúBox',
} as const

export const APP_VERSION = '1.2.9' as const
export const APP_VERSION_LABEL = `KarúBox - v${APP_VERSION}` as const

export type LoginStrings = keyof typeof LOGIN_STRINGS