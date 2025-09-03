export const SPAN_REGEX = /(\\ue203.*?\\ue204)/g;
export const COMPOSITE_REGEX = /(\\ue200.*?\\ue201)/g;
export const STANDALONE_PATTERN = /\\ue202turn(\d+)(search|image|news|video|ref|file)(\d+)/g;
export const CLEANUP_REGEX = /\\ue200|\\ue201|\\ue202|\\ue203|\\ue204|\\ue206|ㅇ/g;
export const INVALID_CITATION_REGEX = /\s*\\ue202turn\d+(search|news|image|video|ref|file)\d+/g;

// Pattern to detect corrupted citation markers (Korean-like characters)
export const CORRUPTED_CITATION_REGEX = /ㅇ(\d{4})(turn\d+(?:search|image|news|video|ref|file)\d+)/g;
// Pattern to clean up remaining Korean characters
export const CORRUPTED_CHAR_CLEANUP_REGEX = /ㅇ/g;
