import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { FindManyOptions, ILike, In, IsNull } from 'typeorm';
import { EventCategory } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  calculatePaginationControls,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import {
  CreateEventCategoryDTO,
  EventCategoriesResponseDTO,
  EventCategoryResponseDTO,
  FindEventCategoryDTO,
} from './dto/event-category.dto';

@Injectable()
export class EventCategoryService
  extends GenericService(EventCategory)
  // implements OnModuleInit
{
  async onModuleInit(): Promise<void> {
    const categories = [
      'WEDDINGS',
      'CHILD DEDICATION',
      'BIRTHDAY',
      'ANNIVERSARY',
      'CHURCH PROGRAM',
      'OTHER',
    ];
    const categoriesFromDB = await this.getRepo().find({
      where: { status: true },
      select: ['id', 'name'],
    });
    const categoriesToCreate: Partial<EventCategory>[] = [];
    for (const category of categories) {
      const existingCategory = categoriesFromDB.find(
        ({ name }) => name === category,
      );
      if (!existingCategory) {
        // Bank does not exist in the database, insert a new record
        categoriesToCreate.push({ name: category });
      }
    }
    if (categoriesToCreate?.length > 0) {
      await this.createMany<Partial<EventCategory>>(categoriesToCreate);
      this.logger.log(`Inserted ${categoriesToCreate.length} new categories`);
    }
    this.logger.debug('Category-data synchronization completed.');
  }

  async createEventCategory(
    payload: CreateEventCategoryDTO,
    userId: string,
  ): Promise<EventCategoryResponseDTO> {
    try {
      checkForRequiredFields(['name', 'userId'], { ...payload, userId });
      validateUUIDField(userId, 'userId');
      const record = await this.getRepo().findOne({
        where: { name: payload.name.toUpperCase(), userId },
        select: ['id'],
      });
      if (record?.id) {
        throw new ConflictException('Similar event-category already exists');
      }
      const createdRecord = await this.create<Partial<EventCategory>>({
        ...payload,
        userId,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdRecord,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUserCategories(
    userId: string,
  ): Promise<EventCategoriesResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      const categories = await this.getRepo().find({
        where: {},
        select: ['id', 'userId'],
      });
      // Get categories user created themselves
      const categoryFilteredList = categories.filter(
        (item) => item.userId === userId,
      );

      // Get categories generically created on the system
      categoryFilteredList.push(...categories.filter((item) => !item.userId));

      // Remove duplicates categoryIds
      const mappedCategoryIds = [
        ...new Set(categoryFilteredList.map(({ id }) => id)),
      ];

      const list = await this.getRepo().find({
        where: { id: In(mappedCategoryIds) },
        relations: ['user'],
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: list,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventCategoryById(
    eventCategoryId: string,
  ): Promise<EventCategoryResponseDTO> {
    try {
      checkForRequiredFields(['eventCategoryId'], { eventCategoryId });
      const record = await this.getRepo().findOne({
        where: { id: eventCategoryId },
        relations: ['user'],
      });
      if (!record?.id) {
        throw new NotFoundException('Event category not found');
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Record found',
        data: record,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventCategories(
    filterOptions: FindEventCategoryDTO,
  ): Promise<EventCategoriesResponseDTO> {
    try {
      const filter: FindManyOptions<EventCategory> = {
        relations: ['user'],
        where: { userId: IsNull() },
      };
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }
      if (filterOptions?.userId) {
        validateUUIDField(filterOptions.userId, 'userId');
        filter.where = {
          ...filter.where,
          userId: filterOptions.userId,
        };
      }
      if (filterOptions?.searchTerm) {
        filter.where = [
          {
            ...filter.where,
            name: ILike(`%${filterOptions.searchTerm}%`),
          },
        ];
      }
      if (filterOptions?.pageNumber && filterOptions?.pageSize) {
        filter.skip = (filterOptions.pageNumber - 1) * filterOptions.pageSize;
        filter.take = filterOptions.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventCategory>(
            this.getRepo(),
            filter,
            {
              pageNumber: filterOptions.pageNumber,
              pageSize: filterOptions.pageSize,
            },
          );
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const users = await this.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: users,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
