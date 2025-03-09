import bs4
import json
import pathlib
import requests


def get_raw_data(url: str, choir_id: int, singer_id: int = None):
    data = {
        'choir_id': choir_id
    }
    if singer_id:
        data['vott_singer_id'] = singer_id

    response = requests.post(url, data=data)
    soup = bs4.BeautifulSoup(response.text, 'html.parser')
    return soup


def extract_section_data(soup: bs4.BeautifulSoup):
    entries = []

    for section in soup.find_all('li'):
        tables = section.find_all('table')
        if len(tables) != 2:
            print('WARNING: unexpected number of tables in')
            print(section.prettify())
            continue

        left, right = tables
        left_fields = left.find_all('td')

        if len(left_fields) != 3:
            print('WARNING: unexpected number of fields in')
            print(left.prettify())
            continue

        date_time, title, duration = left_fields
        date_time = date_time.text.strip()
        title = title.text.strip()
        duration = duration.text.strip()

        rows = right.find_all('tr')

        if len(rows) <= 1:
            print(f'WARNING: unexpected number of rows ({len(rows)}) for "{date_time} - {title}"')
            continue

        for row in rows[1:]:
            fields = row.find_all('td')

            if len(fields) != 5:
                print(f'WARNING: unexpected number of fields in')
                print(row.prettify())
                continue

            marker, page, measure, number_of_singers, voice = fields
            marker = marker.text.strip()
            page = int(page.text.strip())
            measure = int(measure.text.strip())
            number_of_singers = number_of_singers.text.strip()
            voice = voice.text.strip()

            entries.append((title, marker, page, measure, voice))
    return entries


def map_printed_to_pdf_page(printed_page_number: int, letter_name: str):
    pdf_page_number = None    # here 1-indexed
    if 2 <= printed_page_number <= 166:
        pdf_page_number = printed_page_number
    elif 174 <= printed_page_number <= 216:
        pdf_page_number = printed_page_number - 6
    elif printed_page_number == 217:
        if letter_name == 'B5':
            pdf_page_number = 211
        elif letter_name == 'C5':
            pdf_page_number = 212
    elif 224 <= printed_page_number <= 233:
        pdf_page_number = printed_page_number - 10
    elif 243 <= printed_page_number <= 246:
        pdf_page_number = printed_page_number - 18
    elif printed_page_number == 247:
        if letter_name == 'F5':
            pdf_page_number = 229
        elif letter_name == 'G5':
            pdf_page_number = 230
    elif 254 <= printed_page_number <= 257:
        pdf_page_number = printed_page_number - 22
    elif printed_page_number == 258:
        if letter_name == 'H5':
            pdf_page_number = 236
        elif letter_name == 'I5':
            pdf_page_number = 237
    elif 268 <= printed_page_number <= 271:
        pdf_page_number = printed_page_number - 30
    elif 278 <= printed_page_number <= 298:
        pdf_page_number = printed_page_number - 36
    elif 308 <= printed_page_number <= 309:
        pdf_page_number = printed_page_number - 44
    elif 319 <= printed_page_number <= 326:
        pdf_page_number = printed_page_number - 52
    elif 332 <= printed_page_number <= 336:
        pdf_page_number = printed_page_number - 56
    elif printed_page_number == 337:
        if letter_name == 'Q5':
            pdf_page_number = 281
        if letter_name == 'R5':
            pdf_page_number = 282
    elif 347 <= printed_page_number <= 797:
        pdf_page_number = printed_page_number - 64

    if pdf_page_number == None:
        print(f'pdf page number not found for {printed_page_number=}')
        return None

    return pdf_page_number


def generate_boomark_file(sections: list[tuple[str, str, int, int, str]], choir_name: str, output_path: pathlib.Path, voice_aliases: tuple[str, ...] = None):
    file_name = choir_name
    if voice_aliases:
        voice = voice_aliases[0]
        file_name += f'_{voice}'
    file_name += '.json'
    file_name = output_path / file_name

    bookmarks = []
    for title, marker, page, measure, section_voice in sections:
        # check if target voice is present
        if voice_aliases:
            found_voice = False
            for voice in voice_aliases:
                if voice in section_voice:
                    found_voice = True
                    break
            if not found_voice:
                continue

        label = f'{marker} (S. {page}, T. {measure}) - {title}'
        bookmark = {'name': label, 'page': map_printed_to_pdf_page(page, marker)}

        if bookmark not in bookmarks:
            bookmarks.append(bookmark)

    with file_name.open('w+') as fp:
        json.dump(bookmarks, fp, indent=2)


if __name__ == '__main__':
    config_path = pathlib.Path('config.json')
    if not config_path.is_file():
        print('ERROR: config not found')
        exit()

    with config_path.open() as fp:
        config = json.load(fp)

    for variable in ['url', 'output_path']:
        if variable not in config:
            print(f'ERROR: variable "{variable}" not found in config')

    output_path = pathlib.Path(config['output_path'])
    output_path.mkdir(parents=True, exist_ok=True)

    choirs = {
        'LJC': 8,
        'SJC': 9,
        'CWR': 10,
        'CM': 11,
        'PCM': 12,
        'PC': 13,
    }
    voices = [('Sopran', 'Kinderchor', 'SAT'), ('Alt', 'SAT'), ('Tenor', 'SAT'), ('Bass', )]

    for choir_name, choir_id in choirs.items():
        soup = get_raw_data(
            url=config['url'],
            choir_id=choir_id,
        )
        sections = extract_section_data(soup)

        generate_boomark_file(sections, choir_name, output_path)
        for voice_aliases in voices:
            generate_boomark_file(sections, choir_name, output_path, voice_aliases)
