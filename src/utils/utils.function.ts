import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { FindManyOptions, Repository } from 'typeorm';
import axios, { type AxiosResponse } from 'axios';
import { AES, enc } from 'crypto-js';
import { uuidV4 } from '@entities/index';
import { Readable } from 'stream';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import {
  BaseResponseTypeDTO,
  EmailAttachmentDTO,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageKit = require('imagekit');
import { UploadResponse } from 'imagekit/dist/libs/interfaces';

dotenv.config();

const logger = new Logger('Util_Functions');

export const base64ToPNG = (base64String: string): string => {
  // Remove the data URI prefix if it exists
  const data = base64String.replace(/^data:image\/png;base64,/, '');

  // Decode the Base64 string to binary data
  const binaryData = Buffer.from(data, 'base64');

  const outputPath = `uploads/${uuidV4()}.png`;

  // Write the binary data to a file with a .png extension
  fs.writeFileSync(outputPath, binaryData);

  return outputPath;
};

export const base64ToJPEG = (base64String: string): string => {
  // Remove the data URI prefix if it exists
  const data = base64String.replace(/^data:image\/jpe?g;base64,/, '');

  // Decode the Base64 string to binary data
  const binaryData = Buffer.from(data, 'base64');

  const outputPath = `uploads/${uuidV4()}.jpeg`;

  // Write the binary data to a file with a .jpeg extension
  fs.writeFileSync(outputPath, binaryData);

  return outputPath;
};

export const convertHtmlToPDF = async (
  html: string,
  tag = 'NBA Manifest',
  pdfName?: string,
  data = {},
): Promise<{ filename: string }> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require('pdf-creator-node');
    const fileName = `./uploads/${pdfName ?? uuidV4()}.pdf`;
    const document = {
      html,
      data,
      path: fileName,
      type: '',
    };
    const options = {
      format: 'A2',
      orientation: 'landscape',
      border: '10mm',
      childProcessOptions: { env: { OPENSSL_CONF: '/dev/null' } },
      header: {
        height: '5mm',
        contents: `<div style="text-align: center;font-size: 15px;">${tag}</div>`,
      },
      footer: { height: '28mm' },
    };
    return await pdf.create(document, options);
  } catch (ex) {
    logger.error(ex);
    throw ex;
  }
};

export const encryptData = <T>(rawData: T, encryptionKey: string): string => {
  let data: any = rawData;
  if (typeof rawData !== 'string') {
    data = JSON.stringify(rawData);
  }
  return AES.encrypt(data, encryptionKey).toString();
};

export const decryptData = (
  encryptedData: string,
  encryptionKey: string,
): string => AES.decrypt(encryptedData, encryptionKey).toString(enc.Utf8);

export const generateUniqueKey = (length = 5) =>
  (uuidV4() as string).slice(0, length);

export const arrayIncludesAny = <T>(arr: T[], values: T[]) =>
  values.some((v) => arr.includes(v));

export const generateUniqueCode = (length = 4): string =>
  (uuidV4() as string).substring(0, length);

export const compareEnumValues = (value: string, checkAgainst: string[]) => {
  return checkAgainst.includes(value);
};

export const compareEnumValueFields = (
  value: string,
  checkAgainst: string[],
  fieldName?: string,
): void => {
  if (!compareEnumValues(value, checkAgainst)) {
    const message = `Field '${
      fieldName ?? value
    }' can only contain values: ${checkAgainst}`;
    throw new BadRequestException(message);
  }
};

export const checkForRequiredFields = (
  requiredFields: string[],
  requestPayload: any,
): void => {
  const missingFields = requiredFields.filter(
    (field: string) =>
      Object.keys(requestPayload).indexOf(field) < 0 ||
      Object.values(requestPayload)[
        Object.keys(requestPayload).indexOf(field)
      ] === '' ||
      !Object.values(requestPayload)[
        Object.keys(requestPayload).indexOf(field)
      ],
  );
  if (missingFields.length) {
    throw new BadRequestException(
      `Missing required field(s): '${[...missingFields]}'`,
    );
  }
};

export const validateEmailField = (email: string): void => {
  if (!validateEmail(email)) {
    throw new BadRequestException('Field email has invalid format');
  }
};

export const hashPassword = async (rawPassword: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    bcrypt.hash(rawPassword, 10, (err, hash) => {
      if (err) {
        reject(err);
      }
      resolve(hash);
    });
  });
};

export const verifyPasswordHash = async (
  rawPassword: string,
  encryptedPassword: string,
): Promise<string> => {
  return await new Promise((resolve, reject) => {
    bcrypt.compare(rawPassword, encryptedPassword, (err, passwordMatch) => {
      if (err) {
        reject(err);
      }
      resolve(passwordMatch);
    });
  });
};

export const uploadFileToImageKit = async (
  filePath: string,
  deleteAfterUpload = true,
  folderName = 'uploads',
): Promise<string> => {
  const imagekit = new ImageKit({
    publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  });
  const fileExtension = filePath.split('.').pop();
  const imagekitResponse: UploadResponse = await new Promise(
    (resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) throw err;
        imagekit.upload(
          {
            file: data,
            fileName: `${uuidV4()}.${fileExtension}`,
            folderName,
          },
          (error: Error, result: UploadResponse) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
      });
    },
  );
  if (imagekitResponse && deleteAfterUpload) {
    fs.unlinkSync(filePath);
  }
  return imagekitResponse.url;
};

export const uploadFileToS3 = async (
  filePath: string,
  deleteAfterUpload = false,
): Promise<string> => {
  try {
    const s3Client = new S3Client({
      region: 'us-east-2', // Replace with your desired AWS region
      credentials: {
        accessKeyId: String(process.env.AWS_ACCESS_KEY_ID).trim(),
        secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY).trim(),
      },
    });
    const createdReadStream = fs.createReadStream(filePath);
    const s3UploadParams = {
      Bucket: String(process.env.AWS_BUCKET_NAME).trim(),
      Key: `${String(process.env.AWS_KEY_NAME).trim()}/${filePath}`,
      Body: Readable.from(createdReadStream),
      ACL: 'public-read',
    };
    const upload = new Upload({
      client: s3Client,
      params: s3UploadParams,
    });
    const result = await upload.done();
    if (result && deleteAfterUpload) {
      fs.unlinkSync(filePath);
    }
    return result['Location'];
  } catch (ex) {
    logger.error(ex);
    throw ex;
  }
};

export const removeKeyFromObject = (obj: any, keys: string[]): any => {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case 'object':
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          } else {
            //? this handle nested objects
            //? throws Range call stack exceed error
            //? Todo, find a fix for this
            removeKeyFromObject(obj[prop], keys);
          }
          break;
        default:
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          }
          break;
      }
    }
  }
  return obj;
};

export const convertEnumToArray = <T, U>(enumData: U): T[] =>
  Object.values(enumData);

export const shuffleArray = <T>(array: T[]): T[] => {
  return array.length > 0 ? array.sort(() => Math.random() - 0.5) : array;
};

export const groupBy = <T>(list: T[], key: string): any => {
  return list.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export const validateURL = (url: string): boolean => {
  const regEx =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  return regEx.test(url);
};

export const validateTime = (time: string): boolean => {
  const regEx = /\d{1,2}\:\d{1,2} (am|pm)/gim;
  return regEx.test(time);
};

export const validateTimeField = (time: string, field = 'time'): void => {
  if (!validateTime(time)) {
    throw new BadRequestException(
      `Field '${field}' has invalid time format. Expected I.E 09:40 AM`,
    );
  }
};

export const validateURLField = (url: string, field = 'url'): void => {
  if (!validateURL(url)) {
    throw new BadRequestException(`Field '${field}' has invalid url format`);
  }
};

export const validateEmail = (email: string): boolean => {
  const regExp =
    /^[a-zA-Z0-9.!#$%&’*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return regExp.test(email);
};

export const calculatePaginationControls = async <T>(
  repository: Repository<T>,
  options: FindManyOptions<T>,
  payload: PaginationRequestType,
): Promise<{ paginationControl: PaginationResponseType; response: T[] }> => {
  const [response, total] = await repository.findAndCount(options);
  payload = {
    pageNumber: parseInt(String(payload.pageNumber)),
    pageSize: parseInt(String(payload.pageSize)),
  };
  return {
    paginationControl: {
      totalPages: Math.ceil(total / payload?.pageSize),
      currentPage: payload?.pageNumber,
      pageSize: payload?.pageSize,
      hasNext: payload?.pageNumber < Math.ceil(total / payload?.pageSize),
      hasPrevious: payload?.pageNumber > 1,
      totalCount: total,
    },
    response,
  };
};

export const calculatePagination = <T>(
  fullArrayItems: T[],
  payload: PaginationRequestType,
): { paginationControl: PaginationResponseType; response: T[] } => {
  payload = {
    pageNumber: parseInt(String(payload.pageNumber)),
    pageSize: parseInt(String(payload.pageSize)),
  };
  const total = fullArrayItems.length ?? 0;
  const response = fullArrayItems.slice(
    (payload.pageNumber - 1) * payload.pageSize,
    payload.pageNumber * payload.pageSize,
  );
  return {
    paginationControl: {
      totalPages: Math.ceil(total / payload?.pageSize),
      currentPage: payload?.pageNumber,
      pageSize: payload?.pageSize,
      hasNext: payload?.pageNumber < Math.ceil(total / payload?.pageSize),
      hasPrevious: payload?.pageNumber > 1,
      totalCount: total,
    },
    response,
  };
};

export const createLogFile = (path: string): void => {
  const pathSegments = path.split('/');
  if (pathSegments?.length <= 1) {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '');
    }
  } else {
    const dir = pathSegments.slice(0, pathSegments.length - 1).join('/');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '');
    }
  }
};

export const saveLogToFile = (error: any) => {
  try {
    const fileName = 'logs/response-log.txt';
    createLogFile(fileName);

    const errorData = typeof error === 'object' ? JSON.stringify(error) : error;
    const file = fs.createWriteStream(fileName, { flags: 'a' });
    const formattedData = `
      ========${new Date().toISOString()}=============\n
      ${errorData}
      ===============================================\n
    `;
    file.write(formattedData);
  } catch (ex) {
    throw ex;
  }
};

export const formatPhoneNumberWithPrefix = (
  phoneNumber: string,
  prefix = '+234',
): string => {
  let formattedPhoneNumber = phoneNumber;
  if (!phoneNumber.startsWith(prefix)) {
    formattedPhoneNumber = `${prefix}${phoneNumber.slice(1)}`;
  }
  return formattedPhoneNumber;
};

export const sendSMS = async (
  message: string,
  phoneNumbers: string[],
  subject?: string,
): Promise<BaseResponseTypeDTO> => {
  try {
    const key = String(process.env.TEXT_NG_API_KEY);
    const url = 'https://api.textng.xyz/otp-sms/';

    const gatewayResponses = [];
    for (const phoneNumber of phoneNumbers) {
      const formData = new FormData();
      formData.append('key', key);
      formData.append('sender', 'Spraay');
      formData.append('route', '3');
      formData.append('phone', formatPhoneNumberWithPrefix(phoneNumber));
      formData.append('message', message);
      formData.append('siscb', '1');

      const gatewayResponse = await axios({
        url,
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      gatewayResponses.push(gatewayResponse);
    }
    const allSmsSent = gatewayResponses.every(
      (response) => response.status === 200 && response.data,
    );
    const result = new BaseResponseTypeDTO();
    result.success = true;
    result.code = HttpStatus.OK;
    result.message = `SMS messages sent to (${phoneNumbers.length}) number(s)`;
    if (!allSmsSent) {
      result.message = `SMS messages sent to (${phoneNumbers.length}) number(s)`;
    }
    return result;
  } catch (ex) {
    logger.error(ex);
    throw ex;
  }
};

// export const sendSMS = async (
//   message: string,
//   phoneNumbers: string[],
//   subject: string,
//   channel: 'dnd' | 'generic' | 'whatsapp' = 'generic',
// ) => {
//   try {
//     const url = 'https://api.ng.termii.com/api/sms/send';
//     const headers = { 'Content-Type': 'application/json' };
//     const senderId = String(process.env.TERMII_SENDER_ID);
//     const apiKey = String(process.env.TERMII_API_KEY);
//     const smsApiResponse = await httpPost<any, any>(
//       url,
//       {
//         to: [
//           ...phoneNumbers.map((phoneNumber) =>
//             formatPhoneNumberWithPrefix(phoneNumber),
//           ),
//         ],
//         from: senderId,
//         api_key: apiKey,
//         type: 'plain',
//         sms: message,
//         channel,
//       },
//       headers,
//     );
//     if (smsApiResponse?.code === 'ok') {
//       return {
//         success: true,
//         message: 'SMS sent',
//         code: HttpStatus.OK,
//       };
//     }
//   } catch (ex) {
//     if (ex instanceof AxiosError) {
//       logger.error(ex.response.data);
//     }
//     logger.error(ex);
//     return {
//       success: true,
//       message: `SMS not sent: ${ex}`,
//       code: HttpStatus.BAD_GATEWAY,
//     };
//   }
// };

// Video-guide: https://www.youtube.com/watch?v=rQzexLu0eLU
export const sendPushNotification = async (
  message: string,
  deviceId: string,
  subject?: string,
): Promise<BaseResponseTypeDTO> => {
  try {
    const response = await httpPost<any, any>(
      'https://fcm.googleapis.com/fcm/send',
      {
        // registration_ids: [...notification.to],
        to: deviceId,
        notification: {
          body: message,
          title: subject,
          subtitle: subject,
        },
      },
      {
        Authorization: `key=${String(process.env.FIREBASE_SERVER_KEY)}`,
        'Content-Type': 'application/json',
      },
    );
    logger.debug({ response, res_result: response.results });
    if (response.success === 1 && response.failure === 0) {
      return {
        success: true,
        message: `Push notification was sent: ${JSON.stringify(response)}`,
        code: HttpStatus.BAD_GATEWAY,
      };
    }
  } catch (ex) {
    logger.error(ex);
    return {
      success: false,
      code: HttpStatus.BAD_GATEWAY,
      message: `Not sent: ${ex}`,
    };
  }
};

export const sendEmail = async (
  html: string,
  subject: string,
  recipientEmails: string[],
  attachments?: EmailAttachmentDTO[],
): Promise<BaseResponseTypeDTO> => {
  const serverHost = 'smtp.gmail.com';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: serverHost,
    port: 465,
    auth: {
      user: process.env.EMAIL_ADMIN,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions: any = {
    from: `"Spraay App" <${process.env.EMAIL_ADMIN}>`,
    to: recipientEmails.join(','),
    subject,
    html,
  };
  if (attachments?.length > 0) {
    mailOptions.attachments = attachments;
  }
  try {
    const response: any = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        }
        resolve(info);
      });
    });
    if (response?.messageId) {
      return {
        message: `Nodemailer sent message: ${response.messageId}`,
        code: HttpStatus.OK,
        success: true,
      };
    }
  } catch (ex) {
    logger.error(ex);
    return {
      success: false,
      message: 'Email not sent',
      code: HttpStatus.BAD_GATEWAY,
    };
  }
};

export const validateUUID = (uuid: string): boolean => {
  const regExp =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return regExp.test(uuid);
};

export const validateUUIDField = (uuid: string, field = 'id'): void => {
  if (!validateUUID(uuid)) {
    throw new BadRequestException(`Field ${field} has invalid UUID format`);
  }
};

export const countWords = (text: string): number => text.split(' ').length ?? 0;

export const findMatchInArray = (
  arrayOne: string[],
  arrayTwo: string[],
  filter: 'IN' | 'NOT_IN',
): string[] => {
  const mergedArray = [];
  // for array1
  if (filter === 'IN') {
    for (const i in arrayOne) {
      if (arrayTwo.indexOf(arrayOne[i]) !== -1) mergedArray.push(arrayOne[i]);
    }
  } else {
    for (const i in arrayOne) {
      if (arrayTwo.indexOf(arrayOne[i]) === -1) mergedArray.push(arrayOne[i]);
    }
  }
  return mergedArray.sort((x, y) => x - y);
};

/**
 *
 * @param coords1 [longitude, latitude]
 * @param coords2 [longitude, latitude]
 * @returns Number
 */
export const haversineDistance = (
  coords1: number[],
  coords2: number[],
): number => {
  const toRad = (x) => (x * Math.PI) / 180;

  const lon1 = coords1[0];
  const lat1 = coords1[1];

  const lon2 = coords2[0];
  const lat2 = coords2[1];

  const R = 6371; // km

  const x1 = lat2 - lat1;
  const dLat = toRad(x1);
  const x2 = lon2 - lon1;
  const dLon = toRad(x2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Number(d);
};

// console.log(haversineDistance([-73.935242, 40.73061], [-73.934142, 40.731642]));

export const countPattern = (str: string, pattern: RegExp): number => {
  let count = 0;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    count += 1;
  }
  return count;
};

export const findMatchingPattern = (str: string, pattern: RegExp): string[] => {
  let count = 0;
  let match;
  const matchedExp = [];
  while ((match = pattern.exec(str)) !== null) {
    matchedExp.push(match[0]);
    count += 1;
  }
  return matchedExp;
};

export const findFileExtension = (url: string): string => {
  const lastPath = url.split('/').pop();
  if (lastPath?.includes('.')) {
    const [, ext] = lastPath.split('.');
    return ext;
  }
};

export const httpGet = async <T>(url: string, headers = {}): Promise<T> => {
  const response: AxiosResponse = await axios.get(url, { headers });
  return response.data as T;
};

export const httpPost = async <U, T>(
  url: string,
  payload: T,
  headers = {},
): Promise<U> => {
  const response: AxiosResponse = await axios.post(url, payload, { headers });
  return response.data as U;
};

export const httpPatch = async <U, T>(
  url: string,
  payload: T,
  headers = {},
): Promise<U> => {
  const response: AxiosResponse = await axios.patch(url, payload, { headers });
  return response.data as U;
};

export const httpDelete = async <U>(url: string, headers = {}): Promise<U> => {
  const response: AxiosResponse = await axios.delete(url, { headers });
  return response.data as U;
};

export const appendPrefixToString = (prefix: string, word: string): string =>
  word.startsWith(prefix) ? word : `${prefix}${word}`;

export const generateRandomNumber = (prefix = '0'): string => {
  // Generate a random number between 100000000 and 999999999 (inclusive) 9 digits
  const randomNumber = Math.floor(Math.random() * 900000000) + 100000000;
  return `${prefix}${randomNumber.toString()}`;
};

export const generateRandomName = (): string => {
  const firstNames = [
    'Alice',
    'Bob',
    'Charlie',
    'Diana',
    'Eva',
    'Frank',
    'Grace',
    'Henry',
    'Isabella',
    'Jack',
    'Katherine',
    'Liam',
    'Mia',
    'Noah',
    'Olivia',
    'Peter',
    'Quinn',
    'Ryan',
    'Sophia',
    'Thomas',
    'Ursula',
    'Victoria',
    'William',
    'Xavier',
    'Yara',
    'Igwe',
    'Okafor',
    'Adelabi',
    'Oladurun',
    'Ola',
    'Bisi',
    'Taiwo',
    'Kehinde',
    'Zoe',
    'Ola',
    'Obefemi',
    'Odeh',
    'Mark',
  ];
  const lastNames = [
    'Smith',
    'David',
    'Johnson',
    'Onome',
    'Buhari',
    'Udeh',
    'Peter',
    'John',
    'Williams',
    'Jones',
    'Brown',
    'Davis',
    'Miller',
    'Wilson',
    'Moore',
    'Taylor',
    'Anderson',
    'Thomas',
    'Jackson',
    'White',
    'Harris',
    'Martin',
    'Thompson',
    'Garcia',
    'Martinez',
    'Robinson',
    'Clark',
    'Rodriguez',
    'Lewis',
    'Lee',
    'Walker',
  ];
  const randomFirstName =
    firstNames[Math.floor(Math.random() * firstNames.length)];
  const randomLastName =
    lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${randomFirstName} ${randomLastName}`;
};

export const validateBvn = (bvn: string, field = 'bvn'): void => {
  const regExp = /\d{11}/;
  if (!regExp.test(bvn)) {
    throw new BadRequestException(`Field ${field} has invalid bvn format`);
  }
};

export const generateQRCode = async (content: string): Promise<string> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QRCode = require('qrcode');
    return await QRCode.toDataURL(content);
  } catch (ex) {
    throw ex;
  }
};

export const validateFutureDate = (date: Date, field = 'date') => {
  if (new Date().getTime() >= new Date(date).getTime()) {
    throw new BadRequestException(`Field ${field} must be in the future`);
  }
};

export const validatePastDate = (date: Date, field = 'date') => {
  if (new Date().getTime() <= new Date(date).getTime()) {
    throw new BadRequestException(`Field ${field} must be in the past`);
  }
};

export const validateArrayUUIDField = (arrayField: string[], field: string) => {
  if (arrayField?.length > 0) {
    for (let i = 0; i < arrayField.length; i++) {
      const item = arrayField[i];
      validateUUIDField(item, `${field}[${i}]`);
    }
  }
};

export const validateArrayField = (
  arrayField: any,
  field = 'array',
  checkLength = false,
): void => {
  if (!Array.isArray(arrayField)) {
    throw new BadRequestException(
      `Field ${field} has invalid format. Should be an array`,
    );
  }
  if (checkLength) {
    if (arrayField?.length <= 0) {
      throw new BadRequestException(
        `Field ${field} must have at-least 1 element in the array`,
      );
    }
  }
};

export const convert12HourTo24HourFormat = (time12h: string): string => {
  const [time, period] = time12h.split(' ');
  const hourMinuteSplit = time.split(':').map(Number);
  let hour = hourMinuteSplit.shift();
  const minutes = hourMinuteSplit.pop();
  hour = parseInt(String(hour), 10);
  if (period.toLowerCase() === 'pm' && hour < 12) {
    hour += 12;
  }
  return `${hour.toString().padStart(2, '0')}:${minutes
    .toString()
    .padEnd(2, '0')}`;
};

export const addLeadingZeroes = (num: number): string => {
  const numberToString = String(num);
  if (numberToString.length > 1) {
    return numberToString;
  }
  return `0${numberToString}`;
};

export const formatTransactionKey = (key: string) => key.split(' ').join('-');

export const sortArray = <T>(
  data: T[],
  sortedColumn: string,
  filter: 'asc' | 'desc' = 'desc',
): T[] => {
  if (filter === 'asc') {
    return data.sort((a, b) => a[sortedColumn] - b[sortedColumn]);
  }
  return data.sort((a, b) => b[sortedColumn] - a[sortedColumn]);
};

export const differenceInDays = (date1: Date, date2: Date): number => {
  // Time difference in milliseconds
  const timeDiff = date2.getTime() - date1.getTime();

  // Convert time difference from milliseconds to days
  const daysDiff = timeDiff / (1000 * 3600 * 24);

  // Round to get the absolute difference in days
  return Math.abs(Math.round(daysDiff));
};
