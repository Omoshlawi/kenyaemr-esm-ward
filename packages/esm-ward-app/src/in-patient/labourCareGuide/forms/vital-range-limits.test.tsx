import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import BabyForm from './baby-form.component';
import WomanForm from './woman-form.component';

jest.mock('../resources/baby.resource', () => ({
  saveBabyData: jest.fn().mockResolvedValue({ success: true, message: 'saved' }),
}));

const setNumber = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
};

describe('labour care guide vital limits', () => {
  it('accepts pulse 0-300, systolic 0-320, and diastolic 0-200', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <WomanForm
        isOpen
        isEmergencyMode
        onClose={jest.fn()}
        onSubmit={onSubmit}
        patient={{ uuid: 'patient-1', name: 'Amina', gender: 'F', age: '28' }}
      />,
    );

    setNumber(/^pulse/i, '0');
    setNumber(/systolic/i, '0');
    setNumber(/diastolic/i, '0');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ pulse: '0', systolicBp: '0', diastolicBp: '0' }));

    onSubmit.mockClear();
    setNumber(/^pulse/i, '300');
    setNumber(/systolic/i, '320');
    setNumber(/diastolic/i, '200');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ pulse: '300', systolicBp: '320', diastolicBp: '200' }),
    );
  });

  it('shows vital range warnings only after a value is outside the limit', () => {
    render(
      <WomanForm
        isOpen
        isEmergencyMode
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        patient={{ uuid: 'patient-1', name: 'Amina', gender: 'F', age: '28' }}
      />,
    );

    const pulse = screen.getByLabelText(/^pulse/i);
    const systolic = screen.getByLabelText(/systolic/i);
    const diastolic = screen.getByLabelText(/diastolic/i);
    const temperature = screen.getByLabelText(/temperature/i);

    for (const input of [pulse, systolic, diastolic, temperature]) {
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
    }

    fireEvent.change(pulse, { target: { value: '301' } });
    fireEvent.change(systolic, { target: { value: '321' } });
    fireEvent.change(diastolic, { target: { value: '201' } });
    fireEvent.change(temperature, { target: { value: '46' } });

    expect(pulse).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/pulse must be between 0 and 300/i)).toBeInTheDocument();
    expect(screen.getByText(/systolic bp must be between 0 and 320/i)).toBeInTheDocument();
    expect(screen.getByText(/diastolic bp must be between 0 and 200/i)).toBeInTheDocument();
    expect(screen.getByText(/temperature must be between 25 and 45/i)).toBeInTheDocument();

    fireEvent.change(pulse, { target: { value: '80' } });
    expect(pulse).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/pulse must be between 0 and 300/i)).not.toBeInTheDocument();
  });

  it('rejects woman vitals above the new limits', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <WomanForm
        isOpen
        isEmergencyMode
        onClose={jest.fn()}
        onSubmit={onSubmit}
        patient={{ uuid: 'patient-1', name: 'Amina', gender: 'F', age: '28' }}
      />,
    );

    setNumber(/^pulse/i, '301');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts fetal heart rate 0 and 200 and rejects 201', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <BabyForm
        isOpen
        isEmergencyMode
        baseTime="08:00"
        showLowerFields={false}
        onClose={jest.fn()}
        onSubmit={onSubmit}
        patient={{ uuid: 'patient-1', name: 'Amina', gender: 'F', age: '28' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/hours \(hh\)/i)).not.toHaveValue('');
    });

    const saveFhr = async (value: string) => {
      setNumber(/baseline fhr/i, value);
      await user.selectOptions(screen.getByLabelText(/fhr deceleration/i), 'N');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
    };

    await saveFhr('0');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ baselineFhr: '0', fhrDeceleration: 'N' }));

    onSubmit.mockClear();
    await saveFhr('200');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ baselineFhr: '200', fhrDeceleration: 'N' }));

    onSubmit.mockClear();
    await saveFhr('201');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/baseline fhr must be between 0 and 200/i)).toBeInTheDocument();
  });
});
