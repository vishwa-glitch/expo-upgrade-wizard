/**
 * Project context and analysis types
 */

export interface ProjectContext {
  projectRoot?: string;
  fromSdk: string;
  toSdk: string;
  installedPackages: string[];
  packageVersions?: Record<string, string>;
  expoPackages: string[];
  thirdPartyPackages?: string[] | Record<string, string>;
  reactVersion?: string;
  reactNativeVersion?: string;
  packageManager?: "npm" | "yarn" | "pnpm" | "bun";
  multipleLockFiles?: boolean;
  usesReactNativePaper?: boolean;
  hasTypeScript?: boolean;
  hasExpoRouter?: boolean;
  hasReanimated?: boolean;
  hasGestureHandler?: boolean;
  configFiles?: {
    babelConfig: boolean;
    metroConfig: boolean;
    appJson: boolean;
    appConfig: boolean;
    tsConfig: boolean;
  };
  customNativeCode?: boolean;
  workflowType?: "managed" | "bare";
  [key: string]: any; // Allow additional properties
}

export interface AIStep {
  title: string;
  description?: string;
  reason?: string;
  command?: string;
  commands?: string[];
  codeChange?: {
    file: string;
    before?: string;
    after?: string;
  };
  codeChanges?: any[];
  verificationStep?: string;
  estimatedTime?: string | number;
  priority?: "critical" | "high" | "medium" | "low";
  autoFixable?: boolean;
  category?:
    | "package-update"
    | "config-change"
    | "code-migration"
    | "breaking-change"
    | "deprecation"
    | "new-feature";
  [key: string]: any; // Allow additional properties
}

export interface AIGuidance {
  summary: string;
  critical: AIStep[];
  recommended: AIStep[];
  optional: AIStep[];
  estimatedTotalTime: string;
  totalEstimatedTime?: string;
  riskLevel: "low" | "medium" | "high";
  automationLevel: number; // 0-100, percentage of steps that can be automated
}
