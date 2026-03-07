import type {
  AgeGroup,
  PreferredTone,
  PrimaryPlatform,
  WatermarkPosition,
} from "@/lib/models/modelTypes";

const VALID_AGE_GROUPS: AgeGroup[] = ["20s", "30s", "40plus"];
const VALID_PREFERRED_TONES: PreferredTone[] = ["casual", "detailed"];
const VALID_PRIMARY_PLATFORMS: PrimaryPlatform[] = ["naver", "tistory", "medium"];
const VALID_WATERMARK_POSITIONS: WatermarkPosition[] = ["bottom-right", "bottom-left", "top-right", "top-left"];

export interface CreateProfileInput {
  nickname: string;
  ageGroup: AgeGroup;
  preferredTone: PreferredTone;
  primaryPlatform: PrimaryPlatform;
}

export interface UpdateProfileInput {
  nickname?: string;
  ageGroup?: AgeGroup;
  preferredTone?: PreferredTone;
  primaryPlatform?: PrimaryPlatform;
  watermarkText?: string | null;
  watermarkPosition?: WatermarkPosition;
}

export interface ValidationError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export function validateCreateProfileInput(data: unknown): {
  valid: true;
  data: CreateProfileInput;
} | {
  valid: false;
  error: ValidationError;
} {
  if (typeof data !== "object" || data === null) {
    return {
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object",
      },
    };
  }

  const obj = data as Record<string, unknown>;
  const fields: Record<string, string> = {};

  // Validate nickname
  if (typeof obj.nickname !== "string") {
    fields.nickname = "nickname must be a string";
  } else if (obj.nickname.length < 1 || obj.nickname.length > 30) {
    fields.nickname = "nickname must be between 1 and 30 characters";
  }

  // Validate ageGroup
  if (!VALID_AGE_GROUPS.includes(obj.ageGroup as AgeGroup)) {
    fields.ageGroup = `ageGroup must be one of: ${VALID_AGE_GROUPS.join(", ")}`;
  }

  // Validate preferredTone
  if (!VALID_PREFERRED_TONES.includes(obj.preferredTone as PreferredTone)) {
    fields.preferredTone = `preferredTone must be one of: ${VALID_PREFERRED_TONES.join(", ")}`;
  }

  // Validate primaryPlatform
  if (!VALID_PRIMARY_PLATFORMS.includes(obj.primaryPlatform as PrimaryPlatform)) {
    fields.primaryPlatform = `primaryPlatform must be one of: ${VALID_PRIMARY_PLATFORMS.join(", ")}`;
  }

  if (Object.keys(fields).length > 0) {
    return {
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        fields,
      },
    };
  }

  return {
    valid: true,
    data: {
      nickname: obj.nickname as string,
      ageGroup: obj.ageGroup as AgeGroup,
      preferredTone: obj.preferredTone as PreferredTone,
      primaryPlatform: obj.primaryPlatform as PrimaryPlatform,
    },
  };
}

export function validateUpdateProfileInput(data: unknown): {
  valid: true;
  data: UpdateProfileInput;
} | {
  valid: false;
  error: ValidationError;
} {
  if (typeof data !== "object" || data === null) {
    return {
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object",
      },
    };
  }

  const obj = data as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const result: UpdateProfileInput = {};

  // Validate nickname if provided
  if ("nickname" in obj) {
    if (typeof obj.nickname !== "string") {
      fields.nickname = "nickname must be a string";
    } else if (obj.nickname.length < 1 || obj.nickname.length > 30) {
      fields.nickname = "nickname must be between 1 and 30 characters";
    } else {
      result.nickname = obj.nickname;
    }
  }

  // Validate ageGroup if provided
  if ("ageGroup" in obj) {
    if (!VALID_AGE_GROUPS.includes(obj.ageGroup as AgeGroup)) {
      fields.ageGroup = `ageGroup must be one of: ${VALID_AGE_GROUPS.join(", ")}`;
    } else {
      result.ageGroup = obj.ageGroup as AgeGroup;
    }
  }

  // Validate preferredTone if provided
  if ("preferredTone" in obj) {
    if (!VALID_PREFERRED_TONES.includes(obj.preferredTone as PreferredTone)) {
      fields.preferredTone = `preferredTone must be one of: ${VALID_PREFERRED_TONES.join(", ")}`;
    } else {
      result.preferredTone = obj.preferredTone as PreferredTone;
    }
  }

  // Validate primaryPlatform if provided
  if ("primaryPlatform" in obj) {
    if (!VALID_PRIMARY_PLATFORMS.includes(obj.primaryPlatform as PrimaryPlatform)) {
      fields.primaryPlatform = `primaryPlatform must be one of: ${VALID_PRIMARY_PLATFORMS.join(", ")}`;
    } else {
      result.primaryPlatform = obj.primaryPlatform as PrimaryPlatform;
    }
  }

  // Validate watermarkText if provided
  if ("watermarkText" in obj) {
    if (obj.watermarkText === null || obj.watermarkText === "") {
      result.watermarkText = null;
    } else if (typeof obj.watermarkText !== "string") {
      fields.watermarkText = "watermarkText must be a string or null";
    } else if (obj.watermarkText.length > 50) {
      fields.watermarkText = "watermarkText must be 50 characters or less";
    } else {
      result.watermarkText = obj.watermarkText;
    }
  }

  // Validate watermarkPosition if provided
  if ("watermarkPosition" in obj) {
    if (!VALID_WATERMARK_POSITIONS.includes(obj.watermarkPosition as WatermarkPosition)) {
      fields.watermarkPosition = `watermarkPosition must be one of: ${VALID_WATERMARK_POSITIONS.join(", ")}`;
    } else {
      result.watermarkPosition = obj.watermarkPosition as WatermarkPosition;
    }
  }

  if (Object.keys(fields).length > 0) {
    return {
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        fields,
      },
    };
  }

  return {
    valid: true,
    data: result,
  };
}
