import { Button, InlineLoading, InlineNotification, Layer, Pagination, Tag } from '@carbon/react';
import { Calendar, Checkmark, Information, Reset, Save, UserMultiple } from '@carbon/react/icons';
import { ConfigurableLink, restBaseUrl, showSnackbar, useSession, useVisit } from '@openmrs/esm-framework';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import useCurrentPatientAdmissionEncounter from '../../hooks/useCurrentPatientAdmissionEncounter';
import { useIsIsolationAdmission } from '../../hooks/useIsIsolationWard';
import DayMarkPicker from './case-followup-day-picker.component';
import {
  buildContactFollowUpEncounterPayload,
  groupFollowUpMarksByPerson,
  saveContactFollowUpEncounter,
  useContactFollowUp,
  useEbolaContactFollowupConfig,
} from './case-followup.resource';
import {
  applyCodedMarksToContacts,
  buildFollowUpTimeline,
  canEditFollowUpDay,
  cloneFollowUpContacts,
  countFilledFollowUpContacts,
  createIndexFollowUpContact,
  earliestIsoDate,
  FOLLOW_UP_DAY_COUNT,
  FOLLOW_UP_PAGE_SIZE,
  getContactFollowUpDayState,
  getIsolationStay,
  getPatientFollowUpBio,
  mapListedContactToFollowUp,
  mergeFollowUpRows,
  padFollowUpDays,
  toDisplayDate,
  toLocalIsoDate,
  toLocalIsoDateFromDatetime,
  type FollowUpContact,
  type FollowUpMark,
  type FollowUpProgressStatus,
  type FollowUpSaveStatus,
} from './case-followup.utils';
import { useRelationships } from './contact-list/use-contact-mapping';
import styles from './case-followup.scss';

const PATIENT_CHART_URL = '${openmrsSpaBase}/patient/${patientUuid}/chart/Patient Summary';

type CaseFollowUpProps = {
  patientUuid?: string;
};

const EMPTY_DISPLAY = '–';

const displayText = (value?: string) => (value?.trim() ? value : EMPTY_DISPLAY);

const displayDate = (isoDate: string) => toDisplayDate(isoDate) || EMPTY_DISPLAY;

const FollowUpPatientLink: React.FC<{ patientUuid: string; name: string }> = ({ patientUuid, name }) => {
  const display = displayText(name);
  if (!patientUuid || display === EMPTY_DISPLAY) {
    return <>{display}</>;
  }
  return (
    <ConfigurableLink to={PATIENT_CHART_URL} templateParams={{ patientUuid }} className={styles.patientLink}>
      {display}
    </ConfigurableLink>
  );
};

const StatusTag: React.FC<{ status: FollowUpProgressStatus }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === 'active') {
    return (
      <Tag type="green" size="sm" className={styles.statusTag}>
        {t('statusActive', 'Active')}
      </Tag>
    );
  }
  if (status === 'pending') {
    return (
      <Tag type="cool-gray" size="sm" className={styles.statusTag}>
        {t('statusPending', 'Pending')}
      </Tag>
    );
  }
  return null;
};

const StayTag: React.FC<{ contactStartDate: string; isIndex?: boolean }> = ({ contactStartDate, isIndex }) => {
  const { t } = useTranslation();
  const stay = getIsolationStay(contactStartDate);
  if (!contactStartDate) {
    return null;
  }
  const label = isIndex
    ? t('daysAdmittedInWard', '{{elapsed}}/{{total}} days admitted', {
        elapsed: stay.complete ? FOLLOW_UP_DAY_COUNT : stay.elapsed,
        total: FOLLOW_UP_DAY_COUNT,
      })
    : stay.complete
      ? t('isolationComplete', '{{elapsed}}/{{total}} days', {
          elapsed: FOLLOW_UP_DAY_COUNT,
          total: FOLLOW_UP_DAY_COUNT,
        })
      : t('isolationProgress', '{{elapsed}}/{{total}} days', {
          elapsed: stay.elapsed,
          total: FOLLOW_UP_DAY_COUNT,
        });
  return (
    <Tag type={stay.complete ? 'green' : 'blue'} size="sm" className={styles.statusTag}>
      {label}
    </Tag>
  );
};

const CaseFollowUp: React.FC<CaseFollowUpProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { mutate: mutateCache } = useSWRConfig();
  const { sessionLocation, currentProvider } = useSession();
  const { activeVisit } = useVisit(patientUuid ?? '');
  const { patient } = usePatientChartStore(patientUuid ?? '');
  const { admissionEncounter, isLoading: isLoadingAdmission } = useCurrentPatientAdmissionEncounter(patientUuid ?? '');
  const { isIsolationAdmission, isLoading: isLoadingIsolation } = useIsIsolationAdmission(
    admissionEncounter?.location?.uuid,
  );
  const { contacts: listedContacts, isLoading: isLoadingRelationships } = useRelationships(patientUuid ?? '');
  const ebolaContactFollowup = useEbolaContactFollowupConfig();
  const relatedPersonUuids = useMemo(
    () => [...new Set((listedContacts ?? []).map((contact) => contact.uuid).filter(Boolean))],
    [listedContacts],
  );
  const { payload, encounterUuid, storedMarks, isLoading, error, mutate } = useContactFollowUp(
    patientUuid,
    relatedPersonUuids,
  );
  const [contacts, setContacts] = useState<FollowUpContact[]>([]);
  const [savedContacts, setSavedContacts] = useState<FollowUpContact[]>([]);
  const [page, setPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const lastHydratedServerKey = useRef('');
  const patientBio = useMemo(() => getPatientFollowUpBio(patient), [patient]);
  const listedRows = useMemo(() => (listedContacts ?? []).map(mapListedContactToFollowUp), [listedContacts]);

  const isolationStartDate = useMemo(() => {
    const ownMarkDates = (storedMarks ?? [])
      .filter((mark) => mark.contactId === patientUuid)
      .map((mark) => mark.obsDate);
    return earliestIsoDate([
      toLocalIsoDateFromDatetime(admissionEncounter?.encounterDatetime),
      toLocalIsoDateFromDatetime(activeVisit?.startDatetime),
      payload?.isolationStartDate,
      ...ownMarkDates,
    ]);
  }, [
    activeVisit?.startDatetime,
    admissionEncounter?.encounterDatetime,
    patientUuid,
    payload?.isolationStartDate,
    storedMarks,
  ]);

  const indexRow = useMemo(() => {
    if (!patientUuid) {
      return null;
    }
    return createIndexFollowUpContact({
      patientUuid,
      familyName: patientBio.familyName,
      firstName: patientBio.firstName,
      age: patientBio.age,
      sex: patientBio.sex,
      isolationStartDate,
    });
  }, [isolationStartDate, patientBio.age, patientBio.familyName, patientBio.firstName, patientBio.sex, patientUuid]);

  const timeline = useMemo(() => buildFollowUpTimeline(isolationStartDate, contacts), [contacts, isolationStartDate]);
  const today = toLocalIsoDate(new Date());

  useEffect(() => {
    const fromServer = applyCodedMarksToContacts(
      mergeFollowUpRows(indexRow, listedRows, payload?.contacts ?? []),
      storedMarks ?? [],
      isolationStartDate,
    );
    const serverKey = `${encounterUuid ?? ''}:${payload?.status ?? ''}:${isolationStartDate}:${(storedMarks ?? [])
      .map((mark) => `${mark.contactId}:${mark.obsDate ?? mark.day}:${mark.mark}`)
      .join(',')}:${(payload?.contacts ?? []).map((contact) => contact.followUpDays.join('')).join('|')}`;
    setSavedContacts(cloneFollowUpContacts(fromServer));
    setContacts((current) => {
      const serverUpdated = lastHydratedServerKey.current !== serverKey;
      lastHydratedServerKey.current = serverKey;
      if (serverUpdated) {
        setPage(1);
        return fromServer;
      }
      return mergeFollowUpRows(indexRow, listedRows, current);
    });
  }, [encounterUuid, indexRow, isolationStartDate, listedRows, payload, storedMarks]);

  const filledCount = useMemo(() => countFilledFollowUpContacts(contacts), [contacts]);
  const totalPages = Math.max(1, Math.ceil(contacts.length / FOLLOW_UP_PAGE_SIZE) || 1);
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * FOLLOW_UP_PAGE_SIZE;
  const pageContacts = contacts.slice(pageStart, pageStart + FOLLOW_UP_PAGE_SIZE);

  const isFollowUpReadOnly = !isIsolationAdmission;
  const isolationAdmitTitle = t('admitIndexToIsolation', 'Admit this index patient to the isolation ward');
  const isolationAdmitSubtitle = t(
    'followUpViewOnlyUntilAdmitted',
    'Follow-up is view only until this patient is admitted to the isolation ward.',
  );

  const setDayMark = useCallback(
    (contactId: string, dayIndex: number, mark: FollowUpMark) => {
      if (isFollowUpReadOnly) {
        return;
      }
      setContacts((current) =>
        current.map((contact) => {
          if (contact.id !== contactId) {
            return contact;
          }
          const state = getContactFollowUpDayState(isolationStartDate, contact.dateOfLastContact, dayIndex + 1);
          if (!canEditFollowUpDay(state)) {
            return contact;
          }
          const followUpDays = padFollowUpDays(contact.followUpDays, timeline.length);
          followUpDays[dayIndex] = mark;
          return { ...contact, followUpDays };
        }),
      );
    },
    [isFollowUpReadOnly, isolationStartDate, timeline.length],
  );

  const resetForm = () => {
    setContacts(mergeFollowUpRows(indexRow, listedRows, savedContacts));
    setPage(1);
  };

  const saveForm = async (status: FollowUpSaveStatus) => {
    if (isFollowUpReadOnly) {
      showSnackbar({
        title: isolationAdmitTitle,
        subtitle: isolationAdmitSubtitle,
        kind: 'warning',
      });
      return;
    }

    if (!patientUuid) {
      showSnackbar({
        title: t('followUpSaveFailed', 'Unable to save contact follow-up'),
        subtitle: t('patientRequired', 'A patient is required before saving.'),
        kind: 'error',
      });
      return;
    }

    if (!activeVisit?.uuid || !sessionLocation?.uuid || !currentProvider?.uuid) {
      showSnackbar({
        title: t('followUpSaveFailed', 'Unable to save contact follow-up'),
        subtitle: t('activeVisitRequired', 'An active visit, location, and provider are required before saving.'),
        kind: 'error',
      });
      return;
    }

    const paddedContacts = contacts.map((contact) => ({
      ...contact,
      followUpDays: padFollowUpDays(contact.followUpDays, timeline.length),
    }));
    const encounterPayload = buildContactFollowUpEncounterPayload({
      patientUuid,
      visitUuid: activeVisit.uuid,
      locationUuid: sessionLocation.uuid,
      providerUuid: currentProvider.uuid,
      encounterRoleUuid: ebolaContactFollowup.encounterRoleUuid,
      encounterType: ebolaContactFollowup.encounterType,
      payloadConcept: ebolaContactFollowup.payloadConcept,
      contacts: paddedContacts,
      status,
      isolationStartDate,
      encounterUuid,
    });

    try {
      setIsSaving(true);
      await saveContactFollowUpEncounter(
        encounterPayload,
        groupFollowUpMarksByPerson(paddedContacts, timeline, ebolaContactFollowup, {
          isolationStartDate,
          storedMarks,
          today,
        }),
      );
      setSavedContacts(cloneFollowUpContacts(contacts));
      mutate();
      mutateCache(
        (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/encounter?patient=${patientUuid}`),
        undefined,
        {
          revalidate: true,
        },
      );
      showSnackbar({
        title:
          status === 'draft'
            ? t('followUpDraftSaved', 'Contact follow-up saved as draft')
            : t('followUpSubmitted', 'Contact follow-up submitted'),
        kind: 'success',
      });
    } catch (saveError) {
      showSnackbar({
        title: t('followUpSaveFailed', 'Unable to save contact follow-up'),
        subtitle:
          saveError instanceof Error
            ? saveError.message
            : t('unexpectedError', 'An unexpected error occurred while saving.'),
        kind: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isLoadingAdmission || isLoadingIsolation || isLoadingRelationships) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }

  return (
    <Layer className={styles.page}>
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          title={t('followUpLoadError', 'Unable to load contact follow-up')}
          subtitle={error.message}
        />
      ) : null}

      {isFollowUpReadOnly ? (
        <InlineNotification
          className={styles.banner}
          kind="warning"
          lowContrast
          hideCloseButton
          title={isolationAdmitTitle}
          subtitle={isolationAdmitSubtitle}
        />
      ) : null}

      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.titleRow}>
              <Calendar size={20} className={styles.titleIcon} />
              <h3 className={styles.title}>{t('contactFollowUpDetails', 'Contact Follow-up Details')}</h3>
            </div>
            <p className={styles.subtitle}>
              {t(
                'contactFollowUpDetailsSubtitle',
                "Day 1 is this patient's isolation date. Contacts who arrive later line up on that date; the calendar scrolls so each contact can still complete 21 days from the day they arrived.",
              )}
            </p>
          </div>
          <div className={styles.headerActions}>
            {isFollowUpReadOnly ? (
              <Tag type="warm-gray" size="sm">
                {t('followUpViewOnly', 'View only')}
              </Tag>
            ) : null}
            <Tag type="blue" renderIcon={UserMultiple}>
              {t('contactsAdded', '{{count}} contacts added', { count: filledCount })}
            </Tag>
          </div>
        </header>

        <div className={styles.board}>
          <table className={styles.bioTable}>
            <thead>
              <tr>
                <th className={styles.indexCell}>#</th>
                <th className={styles.cnCell}>{t('contactNumber', 'CN')}</th>
                <th className={styles.mobileCell}>{t('mobileNumber', 'Mobile No.')}</th>
                <th className={styles.familyCell}>{t('familyName', 'Family Name')}</th>
                <th className={styles.firstNameCell}>{t('firstName', 'First Name')}</th>
                <th className={styles.ageCell}>{t('age', 'Age')}</th>
                <th className={styles.sexCell}>{t('sex', 'Sex')}</th>
                <th className={styles.dateCell}>{t('dateOfLastContact', 'Date of Last Contact')}</th>
              </tr>
            </thead>
            <tbody>
              {pageContacts.length ? (
                pageContacts.map((contact, index) => (
                  <tr
                    key={contact.id}
                    className={contact.isIndex ? styles.indexRow : undefined}
                    data-testid={contact.isIndex ? 'index-followup-row' : 'contact-followup-row'}>
                    <td className={styles.indexCell}>{pageStart + index + 1}</td>
                    <td className={styles.cnCell}>
                      {contact.isIndex ? t('indexPatient', 'Index') : displayText(contact.cn)}
                    </td>
                    <td className={styles.mobileCell}>{displayText(contact.mobile)}</td>
                    <td className={styles.familyCell}>
                      <FollowUpPatientLink patientUuid={contact.id} name={contact.familyName} />
                    </td>
                    <td className={styles.firstNameCell}>
                      <FollowUpPatientLink patientUuid={contact.id} name={contact.firstName} />
                    </td>
                    <td className={styles.ageCell}>{displayText(contact.age)}</td>
                    <td className={styles.sexCell}>{displayText(contact.sex)}</td>
                    <td className={styles.dateCell}>
                      <div className={styles.dateStack}>
                        <span>{displayDate(contact.dateOfLastContact)}</span>
                        <StayTag contactStartDate={contact.dateOfLastContact} isIndex={contact.isIndex} />
                        <StatusTag status={contact.followUpStatus} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={styles.emptyCell} colSpan={8}>
                    {t('noFollowUpContacts', 'There are no contacts to display. Add contacts from Contact Listing.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {pageContacts.length ? (
            <div
              className={styles.daysScroller}
              style={{ ['--followup-day-count' as string]: timeline.length } as React.CSSProperties}>
              <table className={styles.daysTable}>
                <thead>
                  <tr className={styles.daysTitleRow}>
                    <th className={styles.daysTitleHeader} colSpan={timeline.length} scope="colgroup">
                      <span className={styles.startDateLabel}>
                        {isolationStartDate ? toDisplayDate(isolationStartDate) : EMPTY_DISPLAY}
                      </span>
                      <span className={styles.daysTitle}>{t('dayOfFollowUp', 'Day of Follow-up')}</span>
                    </th>
                  </tr>
                  <tr>
                    {timeline.map((column) => (
                      <th
                        key={column.day}
                        className={classNames(styles.dayHeaderCell, {
                          [styles.dayHeaderToday]: column.date === today,
                        })}
                        aria-label={
                          column.day === 1 && isolationStartDate
                            ? `Day 1, ${toDisplayDate(isolationStartDate)}`
                            : column.date === today
                              ? `Day ${column.day}, today`
                              : `Day ${column.day}`
                        }>
                        <span className={styles.dayHeaderDay}>{column.day}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageContacts.map((contact) => (
                    <tr key={contact.id} className={contact.isIndex ? styles.indexRow : undefined}>
                      {timeline.map((column, dayIndex) => {
                        const state = getContactFollowUpDayState(
                          isolationStartDate,
                          contact.dateOfLastContact,
                          column.day,
                        );
                        return (
                          <td
                            key={column.day}
                            className={classNames(styles.dayCell, {
                              [styles.dayCellToday]: state === 'today',
                            })}>
                            <DayMarkPicker
                              column={column}
                              mark={contact.followUpDays[dayIndex] ?? ''}
                              state={state}
                              readOnly={isFollowUpReadOnly}
                              onSelect={(nextMark) => setDayMark(contact.id, dayIndex, nextMark)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {contacts.length > FOLLOW_UP_PAGE_SIZE ? (
          <Pagination
            page={currentPage}
            pageSize={FOLLOW_UP_PAGE_SIZE}
            pageSizes={[FOLLOW_UP_PAGE_SIZE]}
            totalItems={contacts.length}
            onChange={({ page: nextPage }) => setPage(nextPage)}
          />
        ) : null}

        <footer className={styles.footer}>
          <div className={styles.legend}>
            <Information size={16} className={styles.legendIcon} />
            <div className={styles.legendText}>
              {isFollowUpReadOnly ? (
                <p className={styles.legendLine}>
                  {t(
                    'followUpViewOnlyLegend',
                    '"0" means no fever or bleeding. "X" means died or fever/bleeding. Marks cannot be changed until this index patient is admitted to the isolation ward.',
                  )}
                </p>
              ) : (
                <>
                  <p className={styles.legendLine}>
                    {t('followUpLegendNoSymptoms', 'Select "0" if the contact has not developed fever or bleeding')}
                  </p>
                  <p className={styles.legendLine}>
                    {t(
                      'followUpLegendSymptoms',
                      'Select "X" if the contact has died or developed fever and/or bleeding (complete Case Report Form and, if alive, refer to the hospital)',
                    )}
                  </p>
                  <p className={styles.legendLine}>
                    {t(
                      'followUpLegendTodayOpen',
                      "Today's 0 or X can be changed until the day ends. Past days stay locked.",
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
          {isFollowUpReadOnly ? null : (
            <div className={styles.actions}>
              <Button kind="tertiary" size="md" renderIcon={Reset} onClick={resetForm} disabled={isSaving}>
                {t('reset', 'Reset')}
              </Button>
              <Button
                kind="secondary"
                size="md"
                renderIcon={Save}
                onClick={() => saveForm('draft')}
                disabled={isSaving}>
                {t('saveAsDraft', 'Save as Draft')}
              </Button>
              <Button
                kind="primary"
                size="md"
                renderIcon={Checkmark}
                onClick={() => saveForm('submitted')}
                disabled={isSaving}>
                {t('submit', 'Submit')}
              </Button>
            </div>
          )}
        </footer>
      </section>
    </Layer>
  );
};

export default CaseFollowUp;
