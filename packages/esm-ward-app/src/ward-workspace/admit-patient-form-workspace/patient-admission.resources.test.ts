import { type TFunction } from 'react-i18next';
import { inpatientAdmissionSchema } from './patient-admission.resources';

const t = ((_key: string, defaultValue: string) => defaultValue) as unknown as TFunction;
const categoryUuid = 'ae2b3f93-bd11-4d8f-88ee-bc8d20ab7154';
const pdf = new File(['content'], 'consent.pdf', { type: 'application/pdf' });

const errorPaths = (result: ReturnType<ReturnType<typeof inpatientAdmissionSchema>['safeParse']>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));

describe('inpatientAdmissionSchema', () => {
  const admissionDate = new Date();

  describe('on a psychiatric ward', () => {
    const schema = inpatientAdmissionSchema(true, t);

    it('reports a missing category and attachment on their own fields', () => {
      const result = schema.safeParse({ admissionDate });

      expect(errorPaths(result)).toEqual(['psychiatricCategory', 'attachedFile']);
    });

    it('accepts a category with a PDF attachment', () => {
      const result = schema.safeParse({ admissionDate, psychiatricCategory: categoryUuid, attachedFile: pdf });

      expect(result.success).toBe(true);
    });
  });

  describe('on any other ward', () => {
    const schema = inpatientAdmissionSchema(false, t);

    it('does not require a category or attachment', () => {
      expect(schema.safeParse({ admissionDate }).success).toBe(true);
    });

    it('rejects a file larger than 2 MB', () => {
      const largeFile = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });

      expect(errorPaths(schema.safeParse({ admissionDate, attachedFile: largeFile }))).toEqual(['attachedFile']);
    });

    it('rejects a file that is not a PDF', () => {
      const image = new File(['content'], 'photo.png', { type: 'image/png' });

      expect(errorPaths(schema.safeParse({ admissionDate, attachedFile: image }))).toEqual(['attachedFile']);
    });
  });
});
