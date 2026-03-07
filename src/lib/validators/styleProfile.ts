export interface CreateStyleProfileInput {
  name: string;
  sampleTexts: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export function validateCreateStyleProfile(data: unknown): {
  valid: true;
  data: CreateStyleProfileInput;
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

  // Validate name
  if (typeof obj.name !== "string") {
    fields.name = "name must be a string";
  } else if (obj.name.length < 1 || obj.name.length > 40) {
    fields.name = "name must be between 1 and 40 characters";
  }

  // Validate sampleTexts
  if (!Array.isArray(obj.sampleTexts)) {
    fields.sampleTexts = "sampleTexts must be an array";
  } else if (obj.sampleTexts.length < 3 || obj.sampleTexts.length > 5) {
    fields.sampleTexts = "sampleTexts must have between 3 and 5 items";
  } else {
    // Check each item is a non-empty string
    const invalidItems = obj.sampleTexts.filter(
      (item) => typeof item !== "string" || item.length === 0
    );
    if (invalidItems.length > 0) {
      fields.sampleTexts = "all sampleTexts must be non-empty strings";
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
    data: {
      name: obj.name as string,
      sampleTexts: obj.sampleTexts as string[],
    },
  };
}
