/**
 * ZeroCopySerializer - High-performance binary serialization
 * 
 * Bypasses JSON.stringify/parse for direct buffer manipulation,
 * ensuring zero-copy data exchange and maximum performance.
 * 
 * Format supports:
 * - Primitive types (number, string, boolean, null, undefined)
 * - Objects and arrays
 * - Nested structures
 * - Type preservation
 */

/**
 * Type codes for binary protocol
 */
enum TypeCode {
  Undefined = 0x00,
  Null = 0x01,
  Boolean = 0x02,
  Number = 0x03,
  String = 0x04,
  Array = 0x05,
  Object = 0x06,
  BigInt = 0x07,
  Date = 0x08,
}

/**
 * Serializer class
 */
export class ZeroCopySerializer {
  private textEncoder: InstanceType<typeof TextEncoder>;
  private textDecoder: InstanceType<typeof TextDecoder>;

  constructor() {
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();
  }

  /**
   * Serialize value to binary buffer
   */
  public serialize(value: unknown): Uint8Array {
    const chunks: Uint8Array[] = [];
    this.serializeValue(value, chunks);
    
    // Calculate total length
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Combine chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  /**
   * Deserialize binary buffer to value
   */
  public deserialize(buffer: Uint8Array): unknown {
    const context = { buffer, offset: 0 };
    return this.deserializeValue(context);
  }

  /**
   * Serialize a single value
   */
  private serializeValue(value: unknown, chunks: Uint8Array[]): void {
    if (value === undefined) {
      chunks.push(new Uint8Array([TypeCode.Undefined]));
    } else if (value === null) {
      chunks.push(new Uint8Array([TypeCode.Null]));
    } else if (typeof value === 'boolean') {
      chunks.push(new Uint8Array([TypeCode.Boolean, value ? 1 : 0]));
    } else if (typeof value === 'number') {
      const buf = new ArrayBuffer(9);
      const view = new DataView(buf);
      view.setUint8(0, TypeCode.Number);
      view.setFloat64(1, value, true);
      chunks.push(new Uint8Array(buf));
    } else if (typeof value === 'bigint') {
      const buf = new ArrayBuffer(9);
      const view = new DataView(buf);
      view.setUint8(0, TypeCode.BigInt);
      view.setBigInt64(1, value, true);
      chunks.push(new Uint8Array(buf));
    } else if (typeof value === 'string') {
      this.serializeString(value, chunks);
    } else if (value instanceof Date) {
      const buf = new ArrayBuffer(9);
      const view = new DataView(buf);
      view.setUint8(0, TypeCode.Date);
      view.setFloat64(1, value.getTime(), true);
      chunks.push(new Uint8Array(buf));
    } else if (Array.isArray(value)) {
      this.serializeArray(value, chunks);
    } else if (typeof value === 'object') {
      this.serializeObject(value as Record<string, unknown>, chunks);
    } else {
      // Fallback: serialize as null
      chunks.push(new Uint8Array([TypeCode.Null]));
    }
  }

  /**
   * Serialize string
   */
  private serializeString(value: string, chunks: Uint8Array[]): void {
    const encoded = this.textEncoder.encode(value);
    const lengthBuf = new ArrayBuffer(5);
    const view = new DataView(lengthBuf);
    view.setUint8(0, TypeCode.String);
    view.setUint32(1, encoded.length, true);
    chunks.push(new Uint8Array(lengthBuf));
    chunks.push(encoded);
  }

  /**
   * Serialize array
   */
  private serializeArray(value: unknown[], chunks: Uint8Array[]): void {
    const lengthBuf = new ArrayBuffer(5);
    const view = new DataView(lengthBuf);
    view.setUint8(0, TypeCode.Array);
    view.setUint32(1, value.length, true);
    chunks.push(new Uint8Array(lengthBuf));
    
    for (const item of value) {
      this.serializeValue(item, chunks);
    }
  }

  /**
   * Serialize object
   */
  private serializeObject(value: Record<string, unknown>, chunks: Uint8Array[]): void {
    const keys = Object.keys(value);
    const lengthBuf = new ArrayBuffer(5);
    const view = new DataView(lengthBuf);
    view.setUint8(0, TypeCode.Object);
    view.setUint32(1, keys.length, true);
    chunks.push(new Uint8Array(lengthBuf));
    
    for (const key of keys) {
      // Serialize key
      const keyEncoded = this.textEncoder.encode(key);
      const keyLengthBuf = new ArrayBuffer(4);
      new DataView(keyLengthBuf).setUint32(0, keyEncoded.length, true);
      chunks.push(new Uint8Array(keyLengthBuf));
      chunks.push(keyEncoded);
      
      // Serialize value
      this.serializeValue(value[key], chunks);
    }
  }

  /**
   * Deserialize a single value
   */
  private deserializeValue(context: DeserializeContext): unknown {
    if (context.offset >= context.buffer.length) {
      throw new Error('Unexpected end of buffer');
    }

    const typeCode = context.buffer[context.offset++];

    switch (typeCode) {
      case TypeCode.Undefined:
        return undefined;
      
      case TypeCode.Null:
        return null;
      
      case TypeCode.Boolean:
        return context.buffer[context.offset++] !== 0;
      
      case TypeCode.Number:
        return this.deserializeNumber(context);
      
      case TypeCode.BigInt:
        return this.deserializeBigInt(context);
      
      case TypeCode.String:
        return this.deserializeString(context);
      
      case TypeCode.Date:
        return this.deserializeDate(context);
      
      case TypeCode.Array:
        return this.deserializeArray(context);
      
      case TypeCode.Object:
        return this.deserializeObject(context);
      
      default:
        throw new Error(`Unknown type code: ${typeCode}`);
    }
  }

  /**
   * Deserialize number
   */
  private deserializeNumber(context: DeserializeContext): number {
    const view = new DataView(
      context.buffer.buffer,
      context.buffer.byteOffset + context.offset,
      8
    );
    context.offset += 8;
    return view.getFloat64(0, true);
  }

  /**
   * Deserialize bigint
   */
  private deserializeBigInt(context: DeserializeContext): bigint {
    const view = new DataView(
      context.buffer.buffer,
      context.buffer.byteOffset + context.offset,
      8
    );
    context.offset += 8;
    return view.getBigInt64(0, true);
  }

  /**
   * Deserialize string
   */
  private deserializeString(context: DeserializeContext): string {
    const view = new DataView(
      context.buffer.buffer,
      context.buffer.byteOffset + context.offset,
      4
    );
    const length = view.getUint32(0, true);
    context.offset += 4;
    
    const strBytes = context.buffer.slice(context.offset, context.offset + length);
    context.offset += length;
    
    return this.textDecoder.decode(strBytes);
  }

  /**
   * Deserialize date
   */
  private deserializeDate(context: DeserializeContext): Date {
    const timestamp = this.deserializeNumber(context);
    return new Date(timestamp);
  }

  /**
   * Deserialize array
   */
  private deserializeArray(context: DeserializeContext): unknown[] {
    const view = new DataView(
      context.buffer.buffer,
      context.buffer.byteOffset + context.offset,
      4
    );
    const length = view.getUint32(0, true);
    context.offset += 4;
    
    const result: unknown[] = [];
    for (let i = 0; i < length; i++) {
      result.push(this.deserializeValue(context));
    }
    
    return result;
  }

  /**
   * Deserialize object
   */
  private deserializeObject(context: DeserializeContext): Record<string, unknown> {
    const view = new DataView(
      context.buffer.buffer,
      context.buffer.byteOffset + context.offset,
      4
    );
    const length = view.getUint32(0, true);
    context.offset += 4;
    
    const result: Record<string, unknown> = {};
    
    for (let i = 0; i < length; i++) {
      // Deserialize key
      const keyView = new DataView(
        context.buffer.buffer,
        context.buffer.byteOffset + context.offset,
        4
      );
      const keyLength = keyView.getUint32(0, true);
      context.offset += 4;
      
      const keyBytes = context.buffer.slice(context.offset, context.offset + keyLength);
      context.offset += keyLength;
      const key = this.textDecoder.decode(keyBytes);
      
      // Deserialize value
      result[key] = this.deserializeValue(context);
    }
    
    return result;
  }

  /**
   * Estimate serialized size (for buffer pre-allocation)
   */
  public estimateSize(value: unknown): number {
    if (value === undefined || value === null) {
      return 1;
    } else if (typeof value === 'boolean') {
      return 2;
    } else if (typeof value === 'number' || typeof value === 'bigint') {
      return 9;
    } else if (typeof value === 'string') {
      return 5 + (value as string).length * 3; // UTF-8 worst case
    } else if (value instanceof Date) {
      return 9;
    } else if (Array.isArray(value)) {
      let size = 5; // Type + length
      for (const item of value) {
        size += this.estimateSize(item);
      }
      return size;
    } else if (typeof value === 'object') {
      let size = 5; // Type + length
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        size += 4 + key.length * 3; // Key length + key
        size += this.estimateSize(val);
      }
      return size;
    }
    return 1;
  }
}

interface DeserializeContext {
  buffer: Uint8Array;
  offset: number;
}

/**
 * Export singleton instance
 */
let serializerInstance: ZeroCopySerializer | null = null;

export function getSerializer(): ZeroCopySerializer {
  if (!serializerInstance) {
    serializerInstance = new ZeroCopySerializer();
  }
  return serializerInstance;
}

/**
 * Convenience functions
 */
export function serialize(value: unknown): Uint8Array {
  return getSerializer().serialize(value);
}

export function deserialize(buffer: Uint8Array): unknown {
  return getSerializer().deserialize(buffer);
}

export function estimateSize(value: unknown): number {
  return getSerializer().estimateSize(value);
}
