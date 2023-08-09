import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from '@utils/types/utils.constant';
import { decode } from 'jsonwebtoken';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: any = context.switchToHttp().getRequest();
    const requiredRoles: AppRole = this.reflector.get<AppRole>(
      'roles',
      context.getHandler(),
    );
    return this.validateRequest(request, requiredRoles);
  }

  private validateRequest(
    request: any,
    requiredRoles?: AppRole,
  ): Observable<boolean> | Promise<boolean> | boolean {
    let returnValue = false;
    const extractedHeaders: any = request.headers;

    if (extractedHeaders.authorization) {
      const rawToken: string = (extractedHeaders.authorization as string)
        .split(' ')
        .pop();
      const decodedToken: any = decode(rawToken);

      if (decodedToken) {
        const { exp, role } = decodedToken;

        if (Date.now() <= exp * 1000) {
          request.userData = { ...decodedToken };

          if (requiredRoles) {
            returnValue = this.matchRoles(role, requiredRoles);

            if (!returnValue) {
              throw new UnauthorizedException(
                `Unauthorized...Allows Only: ${[...requiredRoles]} `,
              );
            }
          } else {
            returnValue = true;
          }
        } else
          throw new ForbiddenException(
            'Forbidden...You are using an expired token',
          );
      } else {
        throw new ForbiddenException(
          'Forbidden...Authorization headers were not set',
        );
      }
    }
    return returnValue;
  }

  private matchRoles(role: AppRole, permittedRoles: AppRole): boolean {
    return permittedRoles.includes(role);
  }
}
