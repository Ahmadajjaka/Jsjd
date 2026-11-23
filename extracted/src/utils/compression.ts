/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Maximum Lossless Compression Engine for Firebase Firestore and Local Storage.
 * Uses Deflate Level 9 (Max LZ77 window + Huffman coding) with raw Protocol Buffer Bytes.
 */

import { deflate, inflate } from 'pako';
import { Bytes } from 'firebase/firestore';

export interface CompressionResult {
  compressedBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  ratio: number;
}

/**
 * Compresses any JavaScript object or string into raw binary Uint8Array using Deflate Level 9
 */
export function compressToBytes(data: any): CompressionResult {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const uncompressedBytes = new TextEncoder().encode(jsonString);
    const originalSize = uncompressedBytes.length;

    // Level 9 = Maximum compression (deepest search, optimal Huffman coding)
    const compressedBytes = deflate(uncompressedBytes, {
      level: 9,
      memLevel: 9,
    });

    const compressedSize = compressedBytes.length;
    const savings = Math.max(0, originalSize - compressedSize);
    const savingsPercentage = originalSize > 0 ? (savings / originalSize) * 100 : 0;
    const ratio = compressedSize > 0 ? originalSize / compressedSize : 1;

    return {
      compressedBytes,
      originalSize,
      compressedSize,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      ratio: Math.round(ratio * 10) / 10,
    };
  } catch (err) {
    console.error('Compression error:', err);
    const fallbackBytes = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    return {
      compressedBytes: fallbackBytes,
      originalSize: fallbackBytes.length,
      compressedSize: fallbackBytes.length,
      savingsPercentage: 0,
      ratio: 1,
    };
  }
}

/**
 * Decompresses Uint8Array or Firestore Bytes back to parsed object or string
 */
export function decompressFromBytes<T = any>(source: Uint8Array | Bytes | any): T {
  if (!source) return source;

  try {
    let uint8: Uint8Array;

    if (source instanceof Uint8Array) {
      uint8 = source;
    } else if (typeof source.toUint8Array === 'function') {
      // Firestore native Bytes object
      uint8 = source.toUint8Array();
    } else if (source instanceof ArrayBuffer) {
      uint8 = new Uint8Array(source);
    } else if (Array.isArray(source)) {
      uint8 = new Uint8Array(source);
    } else if (typeof source === 'string') {
      // Base64 encoded fallback
      const binaryString = atob(source);
      const len = binaryString.length;
      uint8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        uint8[i] = binaryString.charCodeAt(i);
      }
    } else {
      return source as T;
    }

    const inflated = inflate(uint8);
    const decompressedStr =
      typeof inflated === 'string'
        ? inflated
        : new TextDecoder().decode(inflated);

    try {
      return JSON.parse(decompressedStr) as T;
    } catch {
      return decompressedStr as unknown as T;
    }
  } catch (err) {
    console.warn('Decompression failed, returning raw source:', err);
    return source as T;
  }
}

/**
 * Packs a document for Firestore with Maximum Compression (Deflate Level 9 + Raw Firestore Bytes).
 * This eliminates repeated field name overhead, stores nested arrays in tight binary format,
 * and cuts storage footprint on Firebase by up to 75%–90%.
 */
export function packDocumentForFirestore(docId: string, data: any): Record<string, any> {
  if (!data) return { id: docId };

  // If already packed, don't double pack
  if (data._c === true && data.d) {
    return data;
  }

  const { compressedBytes, originalSize, compressedSize, savingsPercentage } = compressToBytes(data);

  // Use Firestore Bytes to avoid 33% Base64 string penalty
  const firestoreBytes = Bytes.fromUint8Array(compressedBytes);

  return {
    _c: true, // Marker: compressed document
    _v: 1, // Compression version
    _alg: 'deflate-9', // Algorithm: Deflate level 9
    id: docId || data.id,
    d: firestoreBytes,
    _origBytes: originalSize,
    _compBytes: compressedSize,
    _savedPercent: savingsPercentage,
    _updatedAt: data.updatedAt || data.date || new Date().toISOString(),
  };
}

/**
 * Unpacks a document retrieved from Firestore.
 * Automatically detects whether the document is compressed or legacy uncompressed.
 */
export function unpackDocumentFromFirestore<T = any>(docData: any): T {
  if (!docData) return docData as T;

  // Check if document was stored compressed
  if (docData._c === true && docData.d) {
    const unpacked = decompressFromBytes<T>(docData.d);
    if (unpacked && typeof unpacked === 'object') {
      // Ensure id matches document id
      if (docData.id && !(unpacked as any).id) {
        (unpacked as any).id = docData.id;
      }
      return unpacked;
    }
    return unpacked;
  }

  // Legacy uncompressed document: return directly
  return docData as T;
}

/**
 * Maximum compression helper for localStorage strings
 */
export function compressForLocalStorage(data: any): string {
  try {
    const { compressedBytes } = compressToBytes(data);
    let binary = '';
    const len = compressedBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(compressedBytes[i]);
    }
    return `__COMPRESSED_DEF9__:${btoa(binary)}`;
  } catch (err) {
    console.warn('LocalStorage compression error, falling back to JSON:', err);
    return JSON.stringify(data);
  }
}

/**
 * Maximum decompression helper for localStorage strings
 */
export function decompressFromLocalStorage<T = any>(raw: string | null): T | null {
  if (!raw) return null;

  if (raw.startsWith('__COMPRESSED_DEF9__:')) {
    try {
      const b64 = raw.substring('__COMPRESSED_DEF9__:'.length);
      return decompressFromBytes<T>(b64);
    } catch (err) {
      console.warn('Failed to decompress localStorage data:', err);
      return null;
    }
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}
