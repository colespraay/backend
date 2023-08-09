import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AppRole } from '@utils/types/utils.constant';
import { decode } from 'jsonwebtoken';
import { Observable } from 'rxjs';

@Injectable()
export class DecodeTokenGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: any = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  private validateRequest(
    request: any,
  ): Observable<boolean> | Promise<boolean> | boolean {
    let returnValue = false;
    const extractedHeaders: any = request.headers;

    if (extractedHeaders.authorization) {
      const rawToken: string = (extractedHeaders.authorization as string)
        .split(' ')
        .pop();
      const decodedToken: any = decode(rawToken);
      request.userData = { ...decodedToken };
      returnValue = true;
    } else {
      throw new ForbiddenException(
        'Forbidden...Authorization headers were not set',
      );
    }
    return returnValue;
  }

  private matchRoles(role: AppRole, permittedRoles: AppRole): boolean {
    return permittedRoles.includes(role);
  }
}
