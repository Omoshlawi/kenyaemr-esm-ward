import {
  type Concept,
  type FetchResponse,
  restBaseUrl,
  useConfig,
  useDebounce,
  useOpenmrsFetchAll,
} from '@openmrs/esm-framework';
import { useMemo, useState } from 'react';
import z from 'zod';
import { type WardConfigObject } from '../../config-schema';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useAdmissionLocationTags } from '../../in-patient/in-patient.resource';
import { type TFunction, useTranslation } from 'react-i18next';
export const useDiagnoses = () => {
  const { diagnosisConceptSourceUud } = useConfig<WardConfigObject>();
  const [q, setQ] = useState('');
  const debouncedSearchTerm = useDebounce(q, 500);
  const rep =
    'custom:(uuid,name:(uuid,display),conceptClass:(uuid,display),setMembers,mappings:(conceptReferenceTerm:(code,name,display,conceptSource:(uuid))))';
  const url = `${restBaseUrl}/concept?q=${debouncedSearchTerm}&v=${rep}&references=${diagnosisConceptSourceUud}`;
  const { data, error, isLoading } = useOpenmrsFetchAll<Concept>(debouncedSearchTerm?.length >= 3 ? url : null);
  const diagnoses = useMemo(
    () =>
      (data ?? [])
        .filter((c) =>
          c.mappings?.some((m) => m?.conceptReferenceTerm?.conceptSource?.uuid === diagnosisConceptSourceUud),
        )
        .map((c) => {
          const code = c.mappings?.find(
            (m) => m?.conceptReferenceTerm?.conceptSource?.uuid === diagnosisConceptSourceUud,
          )?.conceptReferenceTerm?.code;

          return {
            display: `${code}-${c.name.display}`,
            uuid: c.uuid,
          };
        }),
    [data, diagnosisConceptSourceUud],
  );
  return {
    diagnoses,
    isLoading,
    error,
    searchTerm: q,
    onSearchTermChange: setQ,
  };
};

type Provider = {
  uuid: string;
  display: string;
};

export const useProviders = () => {
  const url = `${restBaseUrl}/provider?v=custom:(uuid,display)`;
  const { data, error, isLoading } = useOpenmrsFetchAll<Provider>(url);
  return {
    providers: data ?? [],
    error,
    isLoading,
  };
};

export const useProvider = (uuid: string) => {
  const url = `${restBaseUrl}/provider/${uuid}?v=custom:(uuid,display)`;
  const { data, error, isLoading } = useSWR<FetchResponse<Provider>>(url);
  return {
    provider: data?.data,
    error,
    isLoading,
  };
};

export const inpatientAdmissionSchema = (
  isPsychiatric: boolean = false,
  t: TFunction,
  /** When the ward has beds, a real bed is required so the patient lands in Admitted (not Unassigned). */
  requireBed: boolean = true,
) =>
  z
    .object({
      bedId: requireBed
        ? z
            .number({
              required_error: t('pleaseSelectBed', 'Please select a bed'),
              invalid_type_error: t('pleaseSelectBed', 'Please select a bed'),
            })
            .refine((id) => id > 0, { message: t('pleaseSelectBed', 'Please select a bed') })
        : z.number().optional(),
      admissionDate: z.date({ coerce: true }),
      psychiatricCategory: z.string().uuid().optional(),
      attachedFile: z
        .instanceof(File)
        .optional()
        .refine((file) => !file || file.size <= 2 * 1024 * 1024, {
          message: t('fileSizeError', 'File size must be less than 2 MB'),
        })
        .refine((file) => !file || ['application/pdf'].includes(file.type), {
          message: t('fileTypeError', 'File type must be PDF'),
        }),
    })
    .superRefine((data, ctx) => {
      if (isPsychiatric && !data.psychiatricCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['psychiatricCategory'],
          message: t('categoryError', 'Psychiatric category is required for psychiatric wards'),
        });
      }
      if (isPsychiatric && !data.attachedFile) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attachedFile'],
          message: t('attachmentError', 'Attachment is required for psychiatric wards'),
        });
      }
    });

const formartDate = (date: Date) => {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '';
};

export type InapatientAdmissionFormData = z.infer<ReturnType<typeof inpatientAdmissionSchema>>;

export const usePsychiatricWardCategories = (locationUuid?: string) => {
  const { t } = useTranslation();
  const { inpatientLocationTags, psychiatricCategories } = useConfig<WardConfigObject>();
  const { error, isLoading, tags } = useAdmissionLocationTags(locationUuid);
  const isPsychiatricWard = useMemo(
    () => tags.some((tag) => tag.uuid === inpatientLocationTags.psychiatricWard),
    [inpatientLocationTags.psychiatricWard, tags],
  );

  const psychiatricCategoryOptions = useMemo(() => {
    return [
      { label: t('voluntary', 'Voluntary'), value: psychiatricCategories.voluntary },
      { label: t('involuntary', 'Involuntary'), value: psychiatricCategories.involuntary },
      { label: t('emergencyAdmission', 'Emergency Admission'), value: psychiatricCategories.emergencyAdmission },
      { label: t('forensicAdmission', 'Forensic Admission'), value: psychiatricCategories.forensicAdmission },
    ];
  }, [
    psychiatricCategories.emergencyAdmission,
    psychiatricCategories.forensicAdmission,
    psychiatricCategories.involuntary,
    psychiatricCategories.voluntary,
    t,
  ]);

  return {
    isPsychiatricWard,
    error,
    isLoading,
    psychiatricCategoryOptions,
  };
};
