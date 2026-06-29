import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.body) {
      request.body = this.sanitizeObject(request.body);
    }
    return next.handle();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        sanitized[key] = this.sanitizeString(val);
      } else if (typeof val === 'object') {
        sanitized[key] = this.sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  private sanitizeString(str: string): string {
    if (!str) return str;

    // 1. Remove script tags and their inner content
    let cleaned = str.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    );

    // 2. Remove other HTML tags (XSS / HTML injection protection)
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // 3. Remove javascript:, data:, and vbscript: URIs case-insensitively
    cleaned = cleaned.replace(/(javascript|data|vbscript):/gi, '');

    return cleaned.trim();
  }
}
