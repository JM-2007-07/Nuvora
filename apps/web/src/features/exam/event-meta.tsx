import type { ExamEventKind } from '@nuvora/shared';
import {
  BellRingIcon,
  CircleCheckBigIcon,
  DoorOpenIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  FlagOffIcon,
  HourglassIcon,
  LogInIcon,
  type LucideIcon,
  Maximize2Icon,
  Minimize2Icon,
  PauseIcon,
  PlayIcon,
  PlugIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  SquareIcon,
  TimerIcon,
  TriangleAlertIcon,
  UnplugIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react';

export type Tone = 'mag' | 'gold' | 'mint' | 'blue' | 'neutral';

/** How each exam event looks on the teacher's board. `violation` = counts towards the policy. */
export const EVENT_META: Record<ExamEventKind, { Icon: LucideIcon; tone: Tone; violation?: boolean }> = {
  FOCUS_LOST: { Icon: EyeOffIcon, tone: 'mag', violation: true },
  FULLSCREEN_EXIT: { Icon: Minimize2Icon, tone: 'mag', violation: true },
  APP_BACKGROUND: { Icon: SmartphoneIcon, tone: 'mag', violation: true },
  OFFLINE: { Icon: WifiOffIcon, tone: 'gold' },
  ONLINE: { Icon: WifiIcon, tone: 'mint' },
  FOCUS_RETURNED: { Icon: EyeIcon, tone: 'neutral' },
  FULLSCREEN_ENTER: { Icon: Maximize2Icon, tone: 'neutral' },
  APP_FOREGROUND: { Icon: SmartphoneIcon, tone: 'neutral' },
  STARTED: { Icon: PlayIcon, tone: 'blue' },
  RESUMED: { Icon: LogInIcon, tone: 'blue' },
  CONNECTED: { Icon: PlugIcon, tone: 'mint' },
  DISCONNECTED: { Icon: UnplugIcon, tone: 'gold' },
  WARNING: { Icon: TriangleAlertIcon, tone: 'gold' },
  TEACHER_NOTIFIED: { Icon: BellRingIcon, tone: 'gold' },
  PAUSED: { Icon: PauseIcon, tone: 'blue' },
  RESUMED_BY_TEACHER: { Icon: PlayIcon, tone: 'blue' },
  TIME_EXTENDED: { Icon: TimerIcon, tone: 'blue' },
  READMITTED: { Icon: DoorOpenIcon, tone: 'blue' },
  RESET: { Icon: RotateCcwIcon, tone: 'neutral' },
  FLAGGED: { Icon: FlagIcon, tone: 'mag' },
  UNFLAGGED: { Icon: FlagOffIcon, tone: 'neutral' },
  ENDED_BY_TEACHER: { Icon: SquareIcon, tone: 'mag' },
  SUBMITTED: { Icon: CircleCheckBigIcon, tone: 'mint' },
  EXPIRED: { Icon: HourglassIcon, tone: 'gold' },
};

/** Token classes per tone: tinted background, ink for icon and text. */
export const TONE: Record<Tone, string> = {
  mag: 'bg-(--mag-tint) text-(--mag-ink)',
  gold: 'bg-(--gold-tint) text-(--gold-ink)',
  mint: 'bg-(--mint-tint) text-(--mint-ink)',
  blue: 'bg-(--blue-tint) text-(--blue-ink)',
  neutral: 'bg-(--panel2) text-(--muted)',
};

/** Signals shown as chips in the participants table, most serious first. */
export const SIGNAL_CHIPS = ['FOCUS_LOST', 'FULLSCREEN_EXIT', 'APP_BACKGROUND', 'OFFLINE'] as const;
