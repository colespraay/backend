import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { removeKeyFromObject } from '@utils/functions/utils.function';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class HideObjectPropertyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log();
    return next
      .handle()
      .pipe(map((value) => removeKeyFromObject(value, ['logger', 'password'])));
  }
}
