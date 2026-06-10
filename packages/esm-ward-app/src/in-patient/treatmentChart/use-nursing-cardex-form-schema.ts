import { useMemo } from 'react';
import { z } from 'zod';

export type CardexRow = {
  name: string;
  time: string;
  orderUuid?: string;
};

export type CardexFormValues = {
  medicationAdministered: '' | 'yes' | 'no';
  medicationRows: CardexRow[];
  fluidsAdministered: '' | 'yes' | 'no';
  fluidRows: CardexRow[];
};

type Translator = (key: string, defaultValue?: string) => string;

export function useNursingCardexFormSchema(currentTimeMax: string, t: Translator) {
  return useMemo(() => {
    const rowSchema = z.object({
      name: z.string().trim().optional().default(''),
      time: z.string().optional().default(''),
      orderUuid: z.string().optional(),
    });

    return z
      .object({
        medicationAdministered: z.enum(['', 'yes', 'no']),
        medicationRows: z.array(rowSchema),
        fluidsAdministered: z.enum(['', 'yes', 'no']),
        fluidRows: z.array(rowSchema),
      })
      .superRefine((values, context) => {
        if (values.medicationAdministered === 'yes') {
          if (!values.medicationRows.length) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['medicationRows'],
              message: t('medicationRowRequired', 'Add at least one medication row.'),
            });
          } else if (values.medicationRows.some((row) => !row.name?.trim() || !row.time?.trim())) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['medicationRows'],
              message: t('medicationFieldsRequired', 'Medication name and time are required for each row.'),
            });
          } else if (values.medicationRows.some((row) => row.time > currentTimeMax)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['medicationRows'],
              message: t('futureTimeError', 'Cannot select a future time'),
            });
          }
        }

        if (values.fluidsAdministered === 'yes') {
          if (!values.fluidRows.length) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fluidRows'],
              message: t('fluidRowRequired', 'Add at least one fluid row.'),
            });
          } else if (values.fluidRows.some((row) => !row.name?.trim() || !row.time?.trim())) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fluidRows'],
              message: t('fluidFieldsRequired', 'Fluid name and time are required for each row.'),
            });
          } else if (values.fluidRows.some((row) => row.time > currentTimeMax)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fluidRows'],
              message: t('futureTimeError', 'Cannot select a future time'),
            });
          }
        }
      });
  }, [currentTimeMax, t]);
}
